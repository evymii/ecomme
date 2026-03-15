import express from 'express';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { connectDB, disconnectDB } from './config/database.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';
import adminRoutes from './routes/admin.routes.js';
import categoryRoutes from './routes/category.routes.js';
import publicRoutes from './routes/public.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  process.env.FRONTEND_URL, // e.g., https://www.az-souvenir.com
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
  return /^https:\/\/([a-z0-9-]+\.)*az-souvenir\.com$/i.test(normalizedOrigin);
};

const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (curl, mobile apps)
    if (!origin) return callback(null, true);

    if (isTrustedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply globally
app.use(cors(corsOptions));

// Ensure OPTIONS requests are handled
app.options('*', cors(corsOptions));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files with proper CORS headers (only in development/local)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  // Custom middleware for static files with CORS
  app.use('/uploads', (req, res, next) => {
    // Set CORS headers
    const origin = req.headers.origin;
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:3001'
    ].filter(Boolean);
    
    if (!origin || isTrustedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    // Cache headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    next();
  }, express.static('uploads', {
    setHeaders: (res, path) => {
      // Set proper content type
      const ext = path.split('.').pop()?.toLowerCase();
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
    }
  }));
}

// Rate limiting for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { success: false, message: 'Хэт олон оролдлого. 15 минутын дараа дахин оролдоно уу.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Error handler
app.use(errorHandler);

// Connect to database and start server
connectDB().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  });
  
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use!\n`);
      console.error(`To fix this, run in a new terminal:`);
      console.error(`  lsof -ti:${PORT} | xargs kill -9\n`);
      console.error(`Or change PORT in .env file\n`);
      process.exit(1);
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
      console.log('HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });
  });
}).catch((error) => {
  console.error('Failed to connect to database:', error);
  console.error('Check your MONGODB_URI in .env file');
  process.exit(1);
});
