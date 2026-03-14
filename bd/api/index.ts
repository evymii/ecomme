import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from '../src/config/database.js';
import authRoutes from '../src/routes/auth.routes.js';
import userRoutes from '../src/routes/user.routes.js';
import productRoutes from '../src/routes/product.routes.js';
import orderRoutes from '../src/routes/order.routes.js';
import adminRoutes from '../src/routes/admin.routes.js';
import categoryRoutes from '../src/routes/category.routes.js';
import publicRoutes from '../src/routes/public.routes.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

dotenv.config();

const app = express();

// CORS configuration for Vercel
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://www.az-souvenir.com',
  'https://az-souvenir.com',
  'http://localhost:3000',
  'http://localhost:3001',
].filter((origin): origin is string => Boolean(origin));

const normalizeOrigin = (value: string) => value.replace(/\/+$/, '').toLowerCase();
const normalizedAllowedOrigins = allowedOrigins.map((origin) => normalizeOrigin(origin));
const isTrustedOrigin = (origin: string): boolean => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (normalizedAllowedOrigins.includes(normalizedOrigin)) return true;
  // Keep custom domain resilient to www/non-www variations.
  return /^https:\/\/([a-z0-9-]+\.)*az-souvenir\.com$/i.test(normalizedOrigin);
};

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (isTrustedOrigin(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // Do not throw an error here; it turns CORS rejection into 500.
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded images with proper CORS headers (for development)
app.get('/uploads/:folder/:filename', (req, res, next) => {
  // Set CORS headers
  const origin = req.headers.origin;
  if (!origin || isTrustedOrigin(origin) || process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Set proper content type based on file extension
  const filename = req.params.filename;
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  if (ext && contentTypes[ext]) {
    res.setHeader('Content-Type', contentTypes[ext]);
  }
  
  // Cache headers for better performance
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/public', publicRoutes);

// Health check — also warms up the database connection so real requests don't cold-start
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await connectToDatabase();
    dbStatus = 'connected';
  } catch (_e) {
    dbStatus = 'error';
  }
  res.json({
    status: 'ok',
    message: 'Server is running',
    db: dbStatus,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production'
  });
});

// Error handler
app.use(errorHandler);

// Database connection cache for serverless
async function connectToDatabase() {
  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// Export serverless function for Vercel
export default async function handler(req: express.Request, res: express.Response) {
  // Keep a guard timeout just below platform hard timeout.
  const responseTimeout = setTimeout(() => {
    if (!res.headersSent) {
      try {
        res.status(504).json({
          success: false,
          message: 'Request timeout - function execution exceeded time limit'
        });
      } catch (e) {
        // Response already sent or closed
        console.error('Failed to send timeout response:', e);
      }
    }
  }, 9800);

  // Helper to clear timeout and ensure response
  const cleanup = () => {
    clearTimeout(responseTimeout);
  };

  try {
    // Connect to database for all requests (including health check to keep DB warm)
    try {
      await Promise.race([
        connectToDatabase(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Database connection timeout after 7 seconds')), 7000)
        )
      ]);
    } catch (dbError: any) {
      // Health check can still respond even if DB fails
      const isHealthCheck = req.url === '/api/health' || req.url?.startsWith('/api/health');
      if (isHealthCheck) {
        // Let the health check route handler respond (it reports db status)
      } else {
        cleanup();
        console.error('Database connection failed:', dbError.message);
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            message: 'Database connection failed',
            error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
          });
        }
        return;
      }
    }
    
    // Handle the request with Express
    // Wrap in Promise to ensure it resolves/rejects properly
    return new Promise<void>((resolve, reject) => {
      // Set up response handlers
      let resolved = false;
      
      const finish = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };

      const errorHandler = (err: any) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (!res.headersSent) {
            try {
              res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? err?.message : undefined
              });
            } catch (e) {
              console.error('Failed to send error response:', e);
            }
          }
          resolve(); // Resolve instead of reject to prevent unhandled promise
        }
      };

      // Handle Express response completion
      res.on('finish', finish);
      res.on('close', finish);
      res.on('error', errorHandler);

      // Process request with Express
      app(req, res, (err: any) => {
        if (err) {
          errorHandler(err);
        }
        // Note: Express will handle the response, we just wait for it
      });

      // Safety: If response takes too long, force finish
      setTimeout(() => {
        if (!resolved && !res.headersSent) {
          errorHandler(new Error('Response timeout'));
        }
      }, 9600);
    });
  } catch (error: any) {
    cleanup();
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      try {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      } catch (e) {
        console.error('Failed to send error response:', e);
      }
    }
    return Promise.resolve();
  }
}
