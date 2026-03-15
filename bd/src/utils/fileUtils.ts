import cloudinary from '../config/cloudinary.js';

/**
 * Delete image from Cloudinary by URL
 * Used when deleting products to clean up their images
 */
export async function deleteFromCloudinary(url: string): Promise<void> {
  if (!url || !url.includes('res.cloudinary.com')) return;

  const match = url.match(/\/upload\/(?:v\d+\/)?(az-souvenir\/.+)\.\w+$/);
  if (match) {
    try {
      await cloudinary.uploader.destroy(match[1]);
    } catch (e) {
      console.error('Cloudinary delete error:', e);
    }
  }
}
