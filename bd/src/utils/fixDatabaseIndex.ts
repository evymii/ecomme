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

    // Check for old clerkld index
    const clerkldIndex = indexes.find(idx => idx.name === 'clerkld_1' || idx.key?.clerkld);
    
    if (clerkldIndex) {
      console.log('Found old clerkld index, attempting to drop...');
      try {
        if (clerkldIndex.name) {
          await usersCollection.dropIndex(clerkldIndex.name);
          console.log('✅ Successfully dropped clerkld index');
        } else {
          // Try alternative method if name is not available
          await usersCollection.dropIndex({ clerkld: 1 } as any);
          console.log('✅ Successfully dropped clerkld index (alternative method)');
        }
      } catch (error: any) {
        console.error('Error dropping clerkld index:', error.message);
        // Try alternative method
        try {
          await usersCollection.dropIndex({ clerkld: 1 } as any);
          console.log('✅ Successfully dropped clerkld index (alternative method)');
        } catch (altError: any) {
          console.error('Could not drop clerkld index:', altError.message);
          console.log('⚠️  You may need to manually drop this index in MongoDB');
        }
      }
    } else {
      console.log('✅ No clerkld index found, database is clean');
    }

    // Ensure required indexes exist (non-unique, allowing duplicates)
    try {
      // Drop existing unique indexes if they exist
      try {
        await usersCollection.dropIndex('phoneNumber_1');
        console.log('✅ Dropped old unique phoneNumber index');
      } catch (dropError: any) {
        // Index might not exist, that's okay
        if (dropError.code !== 27) { // 27 = index not found
          console.log('Note: phoneNumber index drop:', dropError.message);
        }
      }
      
      await usersCollection.createIndex({ phoneNumber: 1 }, { unique: false });
      console.log('✅ phoneNumber index verified (non-unique)');
    } catch (error: any) {
      if (error.code !== 85) { // 85 = index already exists
        console.error('Error creating phoneNumber index:', error.message);
      }
    }

    try {
      // Drop existing unique indexes if they exist
      try {
        await usersCollection.dropIndex('email_1');
        console.log('✅ Dropped old unique email index');
      } catch (dropError: any) {
        // Index might not exist, that's okay
        if (dropError.code !== 27) { // 27 = index not found
          console.log('Note: email index drop:', dropError.message);
        }
      }
      
      await usersCollection.createIndex({ email: 1 }, { unique: false });
      console.log('✅ email index verified (non-unique)');
    } catch (error: any) {
      if (error.code !== 85) {
        console.error('Error creating email index:', error.message);
      }
    }

  } catch (error: any) {
    console.error('Error fixing database indexes:', error);
  }
};
