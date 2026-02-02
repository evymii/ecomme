import multer from 'multer';
import path from 'path';

// Use memory storage for Vercel serverless functions
// Files are stored in memory and need to be saved to a cloud storage service
// For production, consider using: Vercel Blob, Cloudinary, AWS S3, or similar
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Зөвхөн зураг файл оруулах боломжтой (jpeg, jpg, png, gif, webp)'));
    }
  }
});
