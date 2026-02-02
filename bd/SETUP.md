# Backend Setup Guide

## 1. MongoDB Database Setup

### Option A: Local MongoDB

1. Install MongoDB: https://www.mongodb.com/try/download/community
2. Start MongoDB:
   ```bash
   mongod
   ```
3. In `.env` file:
   ```
   MONGODB_URI=mongodb://localhost:27017/ecomm
   ```

### Option B: MongoDB Atlas (Cloud - Recommended for Vercel)

1. Go to https://www.mongodb.com/cloud/atlas
2. Sign up for free account
3. Create a free cluster (M0)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. Replace `<password>` with your database password
7. In `.env` file:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecomm?retryWrites=true&w=majority
   ```

**Important for MongoDB Atlas:**
- Go to "Network Access" → Add IP Address → Add `0.0.0.0/0` (allow all IPs) for development
- For production, add Vercel's IP ranges or use `0.0.0.0/0` if needed

## 2. Environment Variables

Create `.env` file in the `bd` folder:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/ecomm
# Or MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecomm?retryWrites=true&w=majority

# Server Port
PORT=5001

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Node Environment
NODE_ENV=development

# Admin User (optional - for seeding)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=1234
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Install Dependencies

```bash
cd bd
npm install
# or
yarn install
```

## 4. Seed Database (Optional)

Create initial admin user and categories:

```bash
npm run seed
# or
yarn seed
```

## 5. Run Development Server

```bash
npm run dev
# or
yarn dev
```

Server will run on: http://localhost:5001

Test health check: http://localhost:5001/api/health

## 6. Vercel Deployment

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up/Login
3. Click "New Project"
4. Import your GitHub repository
5. Set root directory to `bd` folder
6. Add Environment Variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Random secret string (32+ characters)
   - `FRONTEND_URL` - Your frontend URL
   - `NODE_ENV` - `production`

### Step 3: Build Settings

Vercel will automatically detect:
- Framework: Other
- Build Command: `npm run vercel-build` or `yarn vercel-build`
- Output Directory: (leave empty)
- Install Command: `npm install` or `yarn install`

### Step 4: Deploy

Click "Deploy" and wait for build to complete.

## 7. Test API

After deployment, test the API:

```bash
# Health check
curl https://your-vercel-url.vercel.app/api/health

# Sign up
curl -X POST https://your-vercel-url.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "99999999",
    "email": "test@example.com",
    "name": "Test User",
    "password": "1234"
  }'
```

## Troubleshooting

### MongoDB Connection Issues

- Check if MongoDB is running (local)
- Verify connection string is correct
- Check network access settings (Atlas)
- Ensure IP address is whitelisted (Atlas)

### Vercel Deployment Issues

- Check build logs in Vercel dashboard
- Verify all environment variables are set
- Check that `vercel.json` is correct
- Ensure `api/index.ts` exists and exports default function

### Port Already in Use

```bash
# Find and kill process on port 5001
lsof -ti:5001 | xargs kill -9
```

## Next Steps

1. Update frontend `NEXT_PUBLIC_API_URL` to point to your Vercel backend URL
2. Test all API endpoints
3. Set up proper file storage (Cloudinary, AWS S3, or Vercel Blob) for production
