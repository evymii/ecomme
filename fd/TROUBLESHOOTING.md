# Frontend Login/Signin Troubleshooting Guide

## Common Issues and Solutions

### 1. Backend Server Not Running

**Check:**
```bash
# In bd folder
cd ../bd
npm run dev
# or
yarn dev
```

**Expected output:**
```
✅ MongoDB connected successfully
✅ Server is running on port 5001
✅ Health check: http://localhost:5001/api/health
```

### 2. MongoDB Not Connected

**Check backend console for:**
```
❌ MongoDB connection error: ...
```

**Solution:**
- Make sure MongoDB is running (local) or MongoDB Atlas connection string is correct
- Check `.env` file in `bd` folder has correct `MONGODB_URI`

### 3. CORS Issues

**Check browser console for:**
```
Access to XMLHttpRequest at 'http://localhost:5001/api/auth/signin' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
- Make sure backend CORS is configured to allow frontend origin
- Check `FRONTEND_URL` in backend `.env` file

### 4. API URL Mismatch

**Check browser console:**
- Look for: `🔗 API URL: ...`
- Should show: `http://localhost:5001/api`

**If wrong:**
- Create `.env.local` in `fd` folder:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:5001/api
  ```
- Restart frontend dev server

### 5. Network Error / Connection Refused

**Check:**
- Is backend running on port 5001?
- Check if port is already in use:
  ```bash
  lsof -ti:5001
  ```

**Solution:**
- Kill process on port 5001:
  ```bash
  lsof -ti:5001 | xargs kill -9
  ```
- Or change PORT in backend `.env` file

### 6. JWT_SECRET Not Set

**Backend error:**
```
JWT_SECRET is not set in environment variables
```

**Solution:**
- Add to backend `.env` file:
  ```
  JWT_SECRET=your-super-secret-jwt-key-min-32-chars
  ```
- Generate random secret:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

### 7. Check Browser Console

Open browser DevTools (F12) and check:
1. **Console tab** - Look for errors
2. **Network tab** - Check if requests are being made
   - Look for `/api/auth/signin` or `/api/auth/signup`
   - Check status code (should be 200 or 201)
   - Check response data

### 8. Test Backend Directly

Test if backend is working:

```bash
# Health check
curl http://localhost:5001/api/health

# Test signup
curl -X POST http://localhost:5001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "99999999",
    "email": "test@example.com",
    "name": "Test User",
    "password": "1234"
  }'

# Test signin
curl -X POST http://localhost:5001/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "99999999",
    "password": "1234"
  }'
```

### 9. Frontend Environment Variables

Create `.env.local` in `fd` folder:

```env
NEXT_PUBLIC_API_URL=http://localhost:5001/api
```

**Important:** Restart frontend dev server after adding environment variables!

### 10. Check Response Format

Backend should return:
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "...",
    "phoneNumber": "...",
    "email": "...",
    "name": "...",
    "role": "user"
  }
}
```

## Step-by-Step Debugging

1. **Start Backend:**
   ```bash
   cd bd
   npm run dev
   ```
   Wait for: `✅ Server is running on port 5001`

2. **Check Backend Health:**
   ```bash
   curl http://localhost:5001/api/health
   ```
   Should return: `{"status":"ok",...}`

3. **Start Frontend:**
   ```bash
   cd fd
   npm run dev
   # or
   yarn dev
   ```

4. **Open Browser Console:**
   - Press F12
   - Go to Console tab
   - Look for `🔗 API URL: http://localhost:5001/api`

5. **Try Login:**
   - Fill in phone number and password
   - Check Network tab for request
   - Check Console for errors

6. **Check Response:**
   - In Network tab, click on the request
   - Check Response tab for error message

## Quick Fix Checklist

- [ ] Backend server is running (`npm run dev` in `bd` folder)
- [ ] MongoDB is connected (check backend console)
- [ ] `.env` file exists in `bd` folder with `MONGODB_URI` and `JWT_SECRET`
- [ ] Frontend `.env.local` has `NEXT_PUBLIC_API_URL=http://localhost:5001/api`
- [ ] Both servers restarted after environment variable changes
- [ ] No port conflicts (port 5001 and 3000 are free)
- [ ] Browser console shows correct API URL
- [ ] Network tab shows requests being made
