import mongoose from 'mongoose';
import { fixDatabaseIndexes } from '../utils/fixDatabaseIndex.js';

/** Reuse connection across Vercel serverless invocations (warm instances). */
let isConnected = false;
/** Deduplicate concurrent connect() calls within the same invocation. */
let connectingPromise: Promise<void> | null = null;

let indexesFixed = false;

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState >= 1) {
    isConnected = true;
    if (!indexesFixed) {
      indexesFixed = true;
      fixDatabaseIndexes().catch((error) => {
        console.error('Index fix failed (background):', error);
      });
    }
    return;
  }

  if (connectingPromise) {
    await connectingPromise;
    return;
  }

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  connectingPromise = (async () => {
    try {
      await mongoose.connect(mongoURI, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      isConnected = true;
      console.log('✅ MongoDB connected successfully');
      console.log(`   Database: ${mongoose.connection.db?.databaseName}`);
    } catch (error) {
      isConnected = false;
      console.error('❌ MongoDB connection error:', error);
      throw error;
    } finally {
      connectingPromise = null;
    }
  })();

  await connectingPromise;

  if (!indexesFixed) {
    indexesFixed = true;
    fixDatabaseIndexes().catch((error) => {
      console.error('Index fix failed (background):', error);
    });
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      isConnected = false;
      console.log('MongoDB disconnected');
    }
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
};
