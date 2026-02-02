/**
 * Convert relative image URL to absolute URL
 * Handles blob URLs (for previews) and server URLs (for saved images)
 */
export function getImageUrl(url: string): string {
  if (!url) return '';
  
  // If it's already a full URL (http/https), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a blob URL (for previews), return as is - these work with regular img tags
  if (url.startsWith('blob:')) {
    return url;
  }
  
  // If it's a relative path, make it absolute
  // Backend URL without /api suffix
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
  const backendUrl = apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:5001';
  const cleanUrl = url.startsWith('/') ? url : '/' + url;
  return `${backendUrl}${cleanUrl}`;
}
