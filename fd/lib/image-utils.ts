/**
 * Convert relative image URL to absolute URL
 * Handles blob URLs (for previews), base64 data URLs, and server URLs (for saved images)
 */

// Compute backend base URL once at module level
const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
if (!rawApiUrl && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_API_URL is required in production');
}
const apiUrl = rawApiUrl || 'http://localhost:5001/api';
const backendUrl = apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:5001';

export function getImageUrl(url: string): string {
  if (!url) return '';

  // If it's already a full URL (http/https), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it's a blob URL (for previews), return as is
  if (url.startsWith('blob:')) {
    return url;
  }

  // If it's a base64 data URL (for Vercel/serverless), return as is
  if (url.startsWith('data:')) {
    return url;
  }

  // If it's a relative path, make it absolute
  const cleanUrl = url.startsWith('/') ? url : '/' + url;
  return `${backendUrl}${cleanUrl}`;
}

/**
 * Return a small Cloudinary thumbnail URL for dense admin grids.
 */
export const CLOUDINARY_THUMBNAIL_SIZE = 80;

export function getCloudinaryThumbnailUrl(
  url: string,
  dimensions: { width?: number; height?: number } = {}
): string {
  const imageUrl = getImageUrl(url);
  if (!imageUrl.includes('res.cloudinary.com') || !imageUrl.includes('/upload/')) {
    return imageUrl;
  }

  const width = dimensions.width ?? CLOUDINARY_THUMBNAIL_SIZE;
  const height = dimensions.height ?? width;
  const transformation = `f_auto,q_auto,c_limit,w_${width},h_${height}`;
  return imageUrl.replace('/upload/', `/upload/${transformation}/`);
}
