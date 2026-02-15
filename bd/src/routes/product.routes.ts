import express from 'express';
import { 
  getAllProducts, 
  getProductById, 
  getProductsByCategory, 
  getFeaturedProducts, 
  getDiscountedProducts,
  searchProducts
} from '../controllers/product.controller.js';

const router = express.Router();

router.get('/', getAllProducts);
router.get('/search', searchProducts);  // Search route - must be before /:id
router.get('/featured', getFeaturedProducts);
router.get('/discounted', getDiscountedProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);

export default router;
