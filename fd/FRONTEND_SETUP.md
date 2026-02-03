# Frontend Backend Connection Setup

## Backend URL
```
https://ecomme-backend-nine.vercel.app
```

## Environment Variables to Set

### In Frontend Vercel Project:

1. Go to: **Settings → Environment Variables**
2. Add/Update:
   - **Key**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://ecomme-backend-nine.vercel.app/api`
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

### In Backend Vercel Project:

1. Go to: **Settings → Environment Variables**
2. Add/Update:
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://your-frontend-url.vercel.app` (replace with your actual frontend URL)
   - **Environments**: ✅ Production, ✅ Preview, ✅ Development

## After Setting Variables:

1. **Redeploy Frontend** - Vercel will auto-redeploy or manually redeploy
2. **Redeploy Backend** - If you updated FRONTEND_URL
3. **Test Connection** - Open browser console on frontend, you should see:
   ```
   🔗 API URL: https://ecomme-backend-nine.vercel.app/api
   ```

## Quick Test Commands:

### Test Backend Health:
```bash
curl https://ecomme-backend-nine.vercel.app/api/health
```

### Test Backend Categories:
```bash
curl https://ecomme-backend-nine.vercel.app/api/categories
```

### Test Backend Products:
```bash
curl https://ecomme-backend-nine.vercel.app/api/products
```

## Troubleshooting:

- **CORS Errors**: Make sure `FRONTEND_URL` in backend matches your frontend URL exactly
- **404 Errors**: Make sure `NEXT_PUBLIC_API_URL` includes `/api` at the end
- **Connection Timeout**: Check backend function logs in Vercel dashboard
