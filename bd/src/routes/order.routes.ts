import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createOrder, getOrderById, getUserOrders } from '../controllers/order.controller.js';

const router = express.Router();

// Checkout doesn't require authentication - allow guest checkout
router.post('/', createOrder);

// User-specific routes require authentication
router.use(authenticate);
router.get('/user', getUserOrders);
router.get('/:id', getOrderById);

export default router;
