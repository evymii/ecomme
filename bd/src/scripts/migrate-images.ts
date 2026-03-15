/**
 * Migration script: Upload base64 images to Cloudinary and update MongoDB
 *
 * Run: cd bd && npx tsx src/scripts/migrate-images.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set');
  process.exit(1);
}

async function uploadBase64ToCloudinary(dataUrl: string): Promise<string> {
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: 'az-souvenir/products',
    format: 'webp',
    quality: 'auto',
  });
  return result.secure_url;
}

function isBase64Image(url: string): boolean {
  return url.startsWith('data:image/');
}

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  console.log('Connected!\n');

  const Product = mongoose.connection.collection('products');
  const products = await Product.find({}).toArray();

  console.log(`Found ${products.length} products total\n`);

  let migratedCount = 0;
  let imageCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    const images = product.images || [];
    const base64Images = images.filter((img: any) => isBase64Image(img.url));

    if (base64Images.length === 0) {
      skippedCount++;
      continue;
    }

    console.log(`[${product.code || product.name}] ${base64Images.length} base64 image(s) found`);

    const updatedImages = [];
    for (const img of images) {
      if (isBase64Image(img.url)) {
        try {
          const cloudinaryUrl = await uploadBase64ToCloudinary(img.url);
          updatedImages.push({
            ...img,
            url: cloudinaryUrl,
          });
          imageCount++;
          console.log(`  -> Uploaded (${Math.round(img.url.length / 1024)}KB base64 -> Cloudinary)`);
        } catch (err: any) {
          console.error(`  -> FAILED: ${err.message}`);
          updatedImages.push(img); // Keep original on failure
        }
      } else {
        updatedImages.push(img); // Already a URL
      }
    }

    await Product.updateOne(
      { _id: product._id },
      { $set: { images: updatedImages } }
    );
    migratedCount++;
  }

  console.log('\n--- Migration Complete ---');
  console.log(`Products migrated: ${migratedCount}`);
  console.log(`Images uploaded: ${imageCount}`);
  console.log(`Products skipped (no base64): ${skippedCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
