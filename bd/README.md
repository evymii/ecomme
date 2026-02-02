# E-commerce Backend API

Онлайн дэлгүүрийн backend API сервер.

## Технологи

- Node.js + Express
- TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Multer (File Upload)
- Vercel Serverless Ready

## Суулгах

```bash
# Dependencies суулгах
npm install
# эсвэл
yarn install
```

## Тохиргоо

1. `.env.example` файлыг `.env` болгон хуулж, утгуудыг бөглөнө:

```bash
cp .env.example .env
```

2. `.env` файлд дараах утгуудыг бөглөнө:

```env
MONGODB_URI=mongodb://localhost:27017/ecomm
# эсвэл MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ecomm?retryWrites=true&w=majority

PORT=5001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## MongoDB Database Тохиргоо

### Local MongoDB:

1. MongoDB суулгах: https://www.mongodb.com/try/download/community
2. MongoDB серверийг эхлүүлэх:
   ```bash
   mongod
   ```
3. `.env` файлд `MONGODB_URI=mongodb://localhost:27017/ecomm` гэж тохируулна

### MongoDB Atlas (Cloud):

1. https://www.mongodb.com/cloud/atlas дээр бүртгүүлэх
2. Free cluster үүсгэх
3. Database Access дээр user үүсгэх
4. Network Access дээр IP хаяг нэмэх (0.0.0.0/0 бүх хаягаас зөвшөөрөх)
5. Connect → Connect your application → Connection string авна
6. `.env` файлд `MONGODB_URI` гэж тохируулна

## Ажиллуулах

### Development:

```bash
npm run dev
# эсвэл
yarn dev
```

Server: http://localhost:5001

### Production Build:

```bash
npm run build
npm start
```

## Vercel дээр Deploy хийх

1. Vercel account үүсгэх: https://vercel.com
2. GitHub repository-г Vercel-д холбох
3. Environment Variables тохируулах:
   - `MONGODB_URI` - MongoDB connection string
   - `JWT_SECRET` - Random secret string
   - `FRONTEND_URL` - Frontend URL
   - `NODE_ENV` - production

4. Deploy хийх:
   ```bash
   vercel
   ```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Бүртгүүлэх
- `POST /api/auth/signin` - Нэвтрэх

### Products
- `GET /api/products` - Бүх бараа
- `GET /api/products/:id` - Барааны дэлгэрэнгүй
- `GET /api/products/category/:category` - Ангилалаар бараа
- `GET /api/products/featured` - Онцлох бараа
- `GET /api/products/discounted` - Хямдарсан бараа

### Categories
- `GET /api/categories` - Бүх ангилал

### Orders (Auth required)
- `POST /api/orders` - Захиалга үүсгэх
- `GET /api/orders/user` - Хэрэглэгчийн захиалгууд
- `GET /api/orders/:id` - Захиалгын дэлгэрэнгүй

### Users (Auth required)
- `GET /api/users/profile` - Профайл авах
- `PUT /api/users/profile` - Профайл шинэчлэх
- `GET /api/users/orders` - Захиалгууд
- `GET /api/users/favorites` - Дуртай бараа

### Admin (Admin only)
- `GET /api/admin/dashboard` - Dashboard статистик
- `GET /api/admin/users` - Бүх хэрэглэгчид
- `PUT /api/admin/users/:id/role` - Хэрэглэгчийн эрх өөрчлөх
- `GET /api/admin/products` - Бүх бараа
- `POST /api/admin/products` - Бараа нэмэх
- `PUT /api/admin/products/:id` - Бараа шинэчлэх
- `DELETE /api/admin/products/:id` - Бараа устгах
- `GET /api/admin/categories` - Бүх ангилал
- `POST /api/admin/categories` - Ангилал нэмэх
- `PUT /api/admin/categories/:id` - Ангилал шинэчлэх
- `DELETE /api/admin/categories/:id` - Ангилал устгах
- `GET /api/admin/orders` - Бүх захиалгууд
- `PUT /api/admin/orders/:id/status` - Захиалгын статус өөрчлөх

## Health Check

- `GET /api/health` - Server status шалгах

## Тэмдэглэл

- File uploads нь development-д local disk дээр хадгалагдана
- Production/Vercel дээр base64 data URLs ашиглана (cloud storage-д шилжүүлэх зөвлөмжтэй)
- JWT token 30 хоногийн хугацаатай
- Admin эрх: `admin@example.com` эсвэл `.env` файлд тодорхойлсон email
