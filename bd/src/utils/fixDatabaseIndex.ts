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

    // Drop stale indexes from the previous auth flow.
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

    // Also drop any index on stale auth fields by key, not name.
    for (const idx of indexes) {
      if (idx.key && (idx.key.clerkId !== undefined || idx.key.clerkld !== undefined || idx.key.clerkUserId !== undefined)) {
        try {
          await usersCollection.dropIndex(idx.name!);
          console.log(`✅ Dropped index "${idx.name}" (stale auth field)`);
        } catch (error: any) {
          if (error.code !== 27) {
            console.error(`Error dropping "${idx.name}":`, error.message);
          }
        }
      }
    }

    // Email is optional now. Drop older email indexes that conflict with the
    // sparse query-only index used by the local auth flow.
    for (const idx of indexes) {
      if (idx.key?.email !== undefined && (idx.unique || idx.sparse !== true)) {
        try {
          await usersCollection.dropIndex(idx.name!);
          console.log(`✅ Dropped incompatible email index "${idx.name}"`);
        } catch (error: any) {
          if (error.code !== 27) {
            console.error(`Error dropping "${idx.name}":`, error.message);
          }
        }
      }
    }

    for (const idx of indexes) {
      if (idx.key?.phoneNumber !== undefined && !idx.unique) {
        try {
          await usersCollection.dropIndex(idx.name!);
          console.log(`✅ Dropped non-unique phoneNumber index "${idx.name}"`);
        } catch (error: any) {
          if (error.code !== 27) {
            console.error(`Error dropping "${idx.name}":`, error.message);
          }
        }
      }
    }

    // Phone number is the login identifier. Prefer a unique index; if existing
    // duplicate data blocks it, the app still rejects duplicates before insert.
    try {
      await usersCollection.createIndex({ phoneNumber: 1 }, { unique: true });
      console.log('✅ phoneNumber index verified');
    } catch (error: any) {
      if (error.code !== 85) { // 85 = index already exists
        console.error('Error creating phoneNumber index:', error.message);
      }
      try {
        await usersCollection.createIndex({ phoneNumber: 1 }, { unique: false });
        console.log('✅ phoneNumber fallback index verified');
      } catch (fallbackError: any) {
        if (fallbackError.code !== 85) {
          console.error('Error creating phoneNumber fallback index:', fallbackError.message);
        }
      }
    }

    try {
      await usersCollection.createIndex({ email: 1 }, { unique: false, sparse: true });
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
