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
  // CRITICAL: Set response timeout to 9 seconds (Vercel Hobby plan = 10s max)
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
  }, 9000); // 9 seconds (1 second buffer before 10s limit)

  // Helper to clear timeout and ensure response
  const cleanup = () => {
    clearTimeout(responseTimeout);
  };

  try {
    // Skip database connection for health check
    const isHealthCheck = req.url === '/api/health' || req.url?.startsWith('/api/health');
    
    if (!isHealthCheck) {
      // Connect to database with strict timeout (5 seconds max)
      try {
        await Promise.race([
          connectToDatabase(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout after 5 seconds')), 5000)
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
      }, 8500); // 8.5 seconds safety net
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
