import mongoose from 'mongoose';

/**
 * Fix old database indexes that may cause issues
 * This should be run once to clean up old indexes
 */
export const fixDatabaseIndexes = async (): Promise<void> => {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.log('Database not connected, skipping index fix');
      return;
    }

    const usersCollection = db.collection('users');
    const indexes = await usersCollection.indexes();
    
    console.log('Current indexes:', indexes.map(idx => idx.name));

    // Drop all stale clerk-related indexes (clerkld_1, clerkId_1, etc.)
    const staleIndexNames = ['clerkld_1', 'clerkId_1', 'clerkUserId_1'];
    for (const idxName of staleIndexNames) {
      const found = indexes.find(idx => idx.name === idxName);
      if (found) {
        console.log(`Found stale index "${idxName}", dropping...`);
        try {
          await usersCollection.dropIndex(idxName);
          console.log(`✅ Dropped stale index "${idxName}"`);
        } catch (error: any) {
          console.error(`Error dropping "${idxName}":`, error.message);
        }
      }
    }

    // Also drop any index on clerkId or clerkld fields (by key, not name)
    for (const idx of indexes) {
      if (idx.key && (idx.key.clerkId !== undefined || idx.key.clerkld !== undefined || idx.key.clerkUserId !== undefined)) {
        try {
          await usersCollection.dropIndex(idx.name!);
          console.log(`✅ Dropped index "${idx.name}" (stale clerk field)`);
        } catch (error: any) {
          if (error.code !== 27) {
            console.error(`Error dropping "${idx.name}":`, error.message);
          }
        }
      }
    }

    // Ensure required indexes exist (non-unique for queries)
    try {
      await usersCollection.createIndex({ phoneNumber: 1 }, { unique: false });
      console.log('✅ phoneNumber index verified');
    } catch (error: any) {
      if (error.code !== 85) { // 85 = index already exists
        console.error('Error creating phoneNumber index:', error.message);
      }
    }

    try {
      await usersCollection.createIndex({ email: 1 }, { unique: false });
      console.log('✅ email index verified');
    } catch (error: any) {
      if (error.code !== 85) {
        console.error('Error creating email index:', error.message);
      }
    }

  } catch (error: any) {
    console.error('Error fixing database indexes:', error);
  }
};
