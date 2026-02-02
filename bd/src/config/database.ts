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
      // Fix indexes asynchronously (non-blocking)
      if (!indexesFixed) {
        indexesFixed = true;
        // Don't await - run in background to avoid blocking requests
        fixDatabaseIndexes().catch(err => console.error('Index fix error:', err));
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
      serverSelectionTimeoutMS: 5000, // Reduced from 10000 to 5000ms
      socketTimeoutMS: 30000, // Reduced from 45000 to 30000ms
      connectTimeoutMS: 5000, // Add connection timeout
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`   Database: ${mongoose.connection.db?.databaseName}`);
    
    // Fix indexes asynchronously (non-blocking)
    if (!indexesFixed) {
      indexesFixed = true;
      // Don't await - run in background to avoid blocking requests
      fixDatabaseIndexes().catch(err => console.error('Index fix error:', err));
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
