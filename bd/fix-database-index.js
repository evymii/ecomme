// Script to fix the old clerkld index issue
// Run this in MongoDB shell or MongoDB Compass

// Connect to your database
// use ecomm

// Drop the old clerkld index
db.users.dropIndex("clerkld_1")

// Verify indexes
db.users.getIndexes()

// If the above doesn't work, try:
// db.users.dropIndex({ clerkld: 1 })

// Or drop all indexes except _id_ and recreate only needed ones:
// db.users.dropIndexes()
// db.users.createIndex({ phoneNumber: 1 }, { unique: true })
// db.users.createIndex({ email: 1 }, { unique: true })
