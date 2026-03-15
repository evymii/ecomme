const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload a single file directly to Cloudinary (unsigned)
 * Returns the secure URL of the uploaded image
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary тохиргоо дутуу байна');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'az-souvenir/products');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    throw new Error('Зураг upload хийхэд алдаа гарлаа');
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Upload multiple files to Cloudinary in parallel
 * Returns array of secure URLs
 */
export async function uploadMultipleToCloudinary(files: File[]): Promise<string[]> {
  return Promise.all(files.map(uploadToCloudinary));
}
