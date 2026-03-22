# Deployment Build Checklist

**Full environment variable inventory:** see [`ENV.md`](./ENV.md) (required keys, optional keys, and how to verify them in Vercel Production).

## ✅ Backend (bd) - Ready for Deployment

### Configuration Files
- ✅ `vercel.json` - Correctly configured with routes and functions
- ✅ `package.json` - Build script skips TypeScript (Vercel handles it)
- ✅ `tsconfig.json` - Proper TypeScript configuration
- ✅ `api/index.ts` - Serverless function entry point exists

### Code Issues Fixed
- ✅ No `bufferMaxEntries` or `bufferCommands` in database config
- ✅ All imports use `.js` extension (ES modules)
- ✅ Environment variables properly handled
- ✅ Database connection optimized for serverless
- ✅ CORS properly configured
- ✅ Error handling in place

### Required Environment Variables (Vercel)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS
- `NODE_ENV` - Set to "production" (optional)

## ✅ Frontend (fd) - Ready for Deployment

### Configuration Files
- ✅ `next.config.js` - Properly configured
- ✅ `package.json` - Correct dependencies
- ✅ `tsconfig.json` - Next.js TypeScript config
- ✅ All pages have proper exports

### Code Issues Fixed
- ✅ `useSearchParams` wrapped in Suspense
- ✅ `export const dynamic = 'force-dynamic'` on products page
- ✅ No hydration errors
- ✅ Image optimization configured
- ✅ Webpack config for html2canvas/jspdf

### Required Environment Variables (Vercel)
- `NEXT_PUBLIC_API_URL` - Backend API URL (e.g., `https://your-backend.vercel.app/api`)

## 🚀 Deployment Steps

### Backend Deployment
1. Push code to GitHub
2. Connect repository to Vercel
3. Set Root Directory to `bd`
4. Set Framework Preset to "Other"
5. Set Build Command to empty (or `echo 'Build complete'`)
6. Set Output Directory to empty
7. Set Install Command to `yarn install`
8. Add environment variables in Vercel dashboard
9. Deploy

### Frontend Deployment
1. Push code to GitHub
2. Connect repository to Vercel
3. Set Root Directory to `fd`
4. Framework Preset: Next.js (auto-detected)
5. Build Command: `next build` (default)
6. Output Directory: `.next` (default)
7. Add `NEXT_PUBLIC_API_URL` environment variable
8. Deploy

## ⚠️ Common Issues to Watch For

1. **TypeScript Errors**: All fixed - no `bufferMaxEntries` or invalid properties
2. **Missing Environment Variables**: Ensure all required vars are set in Vercel
3. **CORS Issues**: Backend has proper CORS configuration
4. **Database Connection**: Optimized for serverless with connection caching
5. **Image Loading**: CORB issues fixed with proper headers
6. **Build Timeouts**: Backend has 9s timeout, database connection 3s

## ✅ All Systems Ready for Deployment
