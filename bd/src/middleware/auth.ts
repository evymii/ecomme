import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  user?: any;
}

const debugLog = (payload: {
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}) => {
  // #region agent log
  fetch('http://127.0.0.1:7831/ingest/7040e2ae-5037-4640-adbd-f649ab17d3e4', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '9f8d20',
    },
    body: JSON.stringify({
      sessionId: '9f8d20',
      ...payload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const runId =
      typeof req.headers['x-debug-run-id'] === 'string'
        ? req.headers['x-debug-run-id']
        : 'initial';
    // #region agent log
    debugLog({
      runId,
      hypothesisId: 'H1',
      location: 'src/middleware/auth.ts:authenticate:entry',
      message: 'Authenticate middleware entry',
      data: {
        method: req.method,
        path: req.originalUrl,
        hasAuthorizationHeader: Boolean(authHeader),
        hasBearerPrefix: Boolean(authHeader?.startsWith('Bearer ')),
      },
    });
    // #endregion
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // #region agent log
      debugLog({
        runId,
        hypothesisId: 'H1',
        location: 'src/middleware/auth.ts:authenticate:missing-header',
        message: 'Rejected request due to missing/invalid auth header',
        data: {
          method: req.method,
          path: req.originalUrl,
          headerSnippet: authHeader ? authHeader.slice(0, 20) : null,
        },
      });
      // #endregion
      res.status(401).json({ success: false, message: 'Нэвтрэх шаардлагатай' });
      return;
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      res.status(401).json({ success: false, message: 'Токен олдсонгүй' });
      return;
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      // #region agent log
      debugLog({
        runId,
        hypothesisId: 'H4',
        location: 'src/middleware/auth.ts:authenticate:missing-jwt-secret',
        message: 'JWT secret is missing in runtime environment',
        data: {
          nodeEnv: process.env.NODE_ENV || null,
          vercelEnv: process.env.VERCEL_ENV || null,
        },
      });
      // #endregion
      console.error('JWT_SECRET is not set in environment variables');
      res.status(500).json({ success: false, message: 'Server configuration error' });
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
      // #region agent log
      debugLog({
        runId,
        hypothesisId: 'H2',
        location: 'src/middleware/auth.ts:authenticate:jwt-verified',
        message: 'JWT verification succeeded',
        data: {
          path: req.originalUrl,
          decodedUserId: decoded?.userId || null,
          tokenLength: token.length,
        },
      });
      // #endregion
      const user = await User.findById(decoded.userId).select('_id role name phoneNumber email').lean();

      if (!user) {
        res.status(401).json({ success: false, message: 'Хэрэглэгч олдсонгүй' });
        return;
      }

      req.userId = user._id.toString();
      req.userRole = user.role;
      req.user = user;
      next();
    } catch (jwtError) {
      // #region agent log
      debugLog({
        runId,
        hypothesisId: 'H2',
        location: 'src/middleware/auth.ts:authenticate:jwt-verify-failed',
        message: 'JWT verification failed',
        data: {
          path: req.originalUrl,
          tokenLength: token.length,
          errorName: jwtError instanceof Error ? jwtError.name : 'unknown',
          errorMessage: jwtError instanceof Error ? jwtError.message : String(jwtError),
        },
      });
      // #endregion
      res.status(401).json({ success: false, message: 'Хүчинтэй токен биш' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ success: false, message: 'Нэвтрэхэд алдаа гарлаа' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const runId =
      typeof req.headers['x-debug-run-id'] === 'string'
        ? req.headers['x-debug-run-id']
        : 'initial';
    // #region agent log
    debugLog({
      runId,
      hypothesisId: 'H3',
      location: 'src/middleware/auth.ts:requireAdmin:entry',
      message: 'Admin role check entry',
      data: {
        method: req.method,
        path: req.originalUrl,
        userRole: req.userRole || null,
        hasUserId: Boolean(req.userId),
      },
    });
    // #endregion
    if (!req.userRole || req.userRole !== 'admin') {
      // #region agent log
      debugLog({
        runId,
        hypothesisId: 'H3',
        location: 'src/middleware/auth.ts:requireAdmin:denied',
        message: 'Admin role check denied',
        data: {
          path: req.originalUrl,
          userRole: req.userRole || null,
        },
      });
      // #endregion
      res.status(403).json({ success: false, message: 'Admin эрх шаардлагатай' });
      return;
    }
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: 'Admin эрх шаардлагатай' });
  }
};
