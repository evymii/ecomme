import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  user?: any;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      console.error('JWT_SECRET is not set in environment variables');
      res.status(500).json({ success: false, message: 'Server configuration error' });
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        res.status(401).json({ success: false, message: 'Хэрэглэгч олдсонгүй' });
        return;
      }

      req.userId = user._id.toString();
      req.userRole = user.role;
      req.user = user;
      next();
    } catch (jwtError) {
      // If JWT verification fails, try to find user by ID (backward compatibility)
      try {
        const user = await User.findById(token).select('-password');
        if (user) {
          req.userId = user._id.toString();
          req.userRole = user.role;
          req.user = user;
          next();
          return;
        }
      } catch (e) {
        // Not a valid ObjectId
      }
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
    if (!req.userRole || req.userRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Admin эрх шаардлагатай' });
      return;
    }
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: 'Admin эрх шаардлагатай' });
  }
};
