import mongoose from 'mongoose';
import { fixDatabaseIndexes } from '../utils/fixDatabaseIndex.js';

// Cache connection for serverless functions (Vercel)
let cachedConnection: typeof mongoose | null = null;
let indexesFixed = false;

export const connectDB = async (): Promise<void> => {
  try {
    // Reuse existing connection if available
    if (cachedConnection && mongoose.connection.readyState === 1) {
      console.log('Using existing MongoDB connection');
      if (!indexesFixed) {
        indexesFixed = true;
        await fixDatabaseIndexes();
      }
      return;
    }

    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Close existing connection if it exists but is not ready
    if (cachedConnection) {
      await mongoose.disconnect();
      cachedConnection = null;
    }

    cachedConnection = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 3000, // 3 seconds - faster for serverless
      socketTimeoutMS: 15000, // 15 seconds for socket operations
      connectTimeoutMS: 3000, // 3 seconds connection timeout
      maxPoolSize: 1, // Single connection for serverless
      minPoolSize: 0, // Allow connection to close when idle
      maxIdleTimeMS: 20000, // Close idle connections after 20s
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`   Database: ${mongoose.connection.db?.databaseName}`);
    
    // Fix stale indexes on first connect (must complete before requests)
    if (!indexesFixed) {
      indexesFixed = true;
      await fixDatabaseIndexes();
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
};

// Graceful disconnect
export const disconnectDB = async (): Promise<void> => {
  try {
    if (cachedConnection) {
      await mongoose.disconnect();
      cachedConnection = null;
      console.log('MongoDB disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
};
