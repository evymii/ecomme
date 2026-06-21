/**
 * Migration script: Upload legacy product images to Cloudinary and update MongoDB.
 *
 * Supports:
 * - base64 data URLs
 * - local /uploads/... paths when the files exist in bd/uploads
 * - absolute backend /uploads/... URLs when they are publicly reachable
 *
 * Run: cd bd && npx tsx src/scripts/migrate-images.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { access } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

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

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Cloudinary environment variables are not fully set');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');

async function uploadToCloudinary(source: string): Promise<string> {
  const result = await cloudinary.uploader.upload(source, {
    folder: 'az-souvenir/products',
    format: 'webp',
    quality: 'auto',
  });
  return result.secure_url;
}

function isBase64Image(url: string): boolean {
  return url.startsWith('data:image/');
}

function isCloudinaryImage(url: string): boolean {
  return url.includes('res.cloudinary.com');
}

function isUploadImage(url: string): boolean {
  if (url.startsWith('/uploads/')) return true;

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname.startsWith('/uploads/');
  } catch (_error) {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function getUploadSource(url: string): Promise<string | null> {
  if (url.startsWith('/uploads/')) {
    const localPath = path.resolve(backendRoot, url.replace(/^\//, ''));
    return (await fileExists(localPath)) ? localPath : null;
  }

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.pathname.startsWith('/uploads/')) return null;

    const localPath = path.resolve(backendRoot, parsedUrl.pathname.replace(/^\//, ''));
    if (await fileExists(localPath)) return localPath;

    return url;
  } catch (_error) {
    return null;
  }
}

async function migrateImageUrl(url: string): Promise<string | null> {
  if (!url || isCloudinaryImage(url)) return null;
  if (isBase64Image(url)) return uploadToCloudinary(url);

  if (isUploadImage(url)) {
    const source = await getUploadSource(url);
    if (!source) return null;

    return uploadToCloudinary(source);
  }

  return null;
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
  let failedCount = 0;

  for (const product of products) {
    const images = product.images || [];
    const legacyImages = images.filter((img: any) => {
      const url = typeof img?.url === 'string' ? img.url : '';
      return !isCloudinaryImage(url) && (isBase64Image(url) || isUploadImage(url));
    });

    if (legacyImages.length === 0) {
      skippedCount++;
      continue;
    }

    console.log(`[${product.code || product.name}] ${legacyImages.length} legacy image(s) found`);

    const updatedImages = [];
    let hasChanges = false;

    for (const img of images) {
      const url = typeof img?.url === 'string' ? img.url : '';

      try {
        const cloudinaryUrl = await migrateImageUrl(url);
        if (cloudinaryUrl) {
          updatedImages.push({
            ...img,
            url: cloudinaryUrl,
          });
          hasChanges = true;
          imageCount++;
          console.log(`  -> Uploaded ${url.slice(0, 80)} -> Cloudinary`);
          continue;
        }
      } catch (err: any) {
        failedCount++;
        console.error(`  -> FAILED ${url.slice(0, 80)}: ${err.message}`);
      }

      updatedImages.push(img);
    }

    if (hasChanges) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { images: updatedImages } }
      );
      migratedCount++;
    }
  }

  console.log('\n--- Migration Complete ---');
  console.log(`Products migrated: ${migratedCount}`);
  console.log(`Images uploaded: ${imageCount}`);
  console.log(`Images failed: ${failedCount}`);
  console.log(`Products skipped (no legacy images): ${skippedCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
