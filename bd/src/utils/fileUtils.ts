import fs from 'fs';
import path from 'path';

/**
 * Convert file buffer to base64 data URL
 * This is a temporary solution for Vercel serverless functions
 * For production, use cloud storage (Vercel Blob, Cloudinary, AWS S3, etc.)
 */
export function bufferToDataURL(buffer: Buffer, mimetype: string): string {
  const base64 = buffer.toString('base64');
  return `data:${mimetype};base64,${base64}`;
}

/**
 * Generate a unique filename for storage reference
 */
export function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1E9);
  const ext = originalName.split('.').pop() || 'jpg';
  return `image-${timestamp}-${random}.${ext}`;
}

/**
 * Save file buffer to local storage (for development only)
 * In production/Vercel, use base64 data URLs or cloud storage
 */
export async function saveFileLocally(
  buffer: Buffer,
  filename: string,
  folder: string = 'products'
): Promise<string> {
  // Only save locally if not in Vercel/serverless environment
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    // In serverless, return base64 data URL instead
    return bufferToDataURL(buffer, 'image/jpeg');
  }

  const uploadDir = path.join(process.cwd(), 'uploads', folder);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);
  
  // Return relative path for URL
  return `/uploads/${folder}/${filename}`;
}
