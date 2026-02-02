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
  // Set timeout to prevent hanging
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: 'Request timeout'
      });
    }
  }, 25000); // 25 seconds timeout (before 30s maxDuration)

  try {
    // Skip database connection for health check
    const isHealthCheck = req.url === '/api/health' || req.url?.startsWith('/api/health');
    
    if (!isHealthCheck) {
      // Connect to database on each request (connection is cached)
      try {
        await Promise.race([
          connectToDatabase(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Database connection timeout')), 8000)
          )
        ]);
      } catch (dbError: any) {
        clearTimeout(timeout);
        console.error('Database connection failed:', dbError);
        if (!res.headersSent) {
          res.status(503).json({
            success: false,
            message: 'Database connection failed',
            error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
          });
          return;
        }
      }
    }
    
    // Handle the request
    return new Promise((resolve, reject) => {
      app(req, res, (err: any) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  } catch (error: any) {
    clearTimeout(timeout);
    console.error('Serverless function error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    return Promise.resolve(res);
  }
}
