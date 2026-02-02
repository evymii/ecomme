import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { 
  getDashboardStats, 
  getAllUsers, 
  updateUserRole, 
  getAllProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct, 
  getAllOrders, 
  updateOrderStatus 
} from '../controllers/admin.controller.js';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller.js';
import { upload } from '../config/multer.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', getDashboardStats);

// Users
router.get('/users', getAllUsers);
router.put('/users/:id/role', updateUserRole);

// Categories
router.get('/categories', getAllCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Products
router.get('/products', getAllProducts);
router.post('/products', upload.array('images', 10) as any, createProduct);
router.put('/products/:id', upload.array('images', 10) as any, updateProduct);
router.delete('/products/:id', deleteProduct);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);

export default router;
