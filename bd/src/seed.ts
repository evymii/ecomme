import dotenv from 'dotenv';
import { connectDB, disconnectDB } from './config/database.js';
import User from './models/User.model.js';
import Category from './models/Category.model.js';
import Product from './models/Product.model.js';
import bcrypt from 'bcrypt';

dotenv.config();

async function seed() {
  try {
    await connectDB();
    console.log('✅ Connected to database');

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await User.deleteMany({});
    // await Category.deleteMany({});
    // await Product.deleteMany({});

    // Create admin user
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || '1234';
    
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      adminUser = new User({
        phoneNumber: '99999999',
        email: adminEmail,
        name: 'Admin User',
        password: hashedPassword,
        role: 'admin'
      });
      await adminUser.save();
      console.log('✅ Admin user created:', adminEmail);
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create sample categories
    const categories = [
      { name: 'Jersey', nameEn: 'Jersey', description: 'Jerseys and sportswear' },
      { name: 'Accessories', nameEn: 'Accessories', description: 'Accessories and add-ons' },
      { name: 'Lifestyle', nameEn: 'Lifestyle', description: 'Lifestyle products' }
    ];

    for (const catData of categories) {
      let category = await Category.findOne({ name: catData.name });
      if (!category) {
        category = new Category(catData);
        await category.save();
        console.log(`✅ Category created: ${catData.name}`);
      }
    }

    console.log('✅ Seeding completed successfully');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    await disconnectDB();
    process.exit(1);
  }
}

seed();
