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
import { errorHandler } from '../src/middleware/errorHandler.js';

dotenv.config();

const app = express();

// CORS configuration for Vercel
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
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
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001'
  ].filter(Boolean);
  
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
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

// Health check (no database required)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production'
  });
});

// Error handler
app.use(errorHandler);

// Database connection cache for serverless
let cachedConnection: any = null;

async function connectToDatabase() {
  if (cachedConnection) {
    return cachedConnection;
  }

  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    cachedConnection = await connectDB();
    return cachedConnection;
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
    // Skip database connection for health check
    const isHealthCheck = req.url === '/api/health' || req.url?.startsWith('/api/health');
    
    if (!isHealthCheck) {
      // Connect to database with balanced timeout for cold starts.
      try {
        await Promise.race([
          connectToDatabase(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout after 7 seconds')), 7000)
          )
        ]);
      } catch (dbError: any) {
        cleanup();
        console.error('Database connection failed:', dbError.message);
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            message: 'Database connection failed',
            error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
          });
        }
        return; // CRITICAL: Return immediately to prevent further execution
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
