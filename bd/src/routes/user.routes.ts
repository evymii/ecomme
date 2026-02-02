import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getProfile, updateProfile, getFavorites } from '../controllers/user.controller.js';
import { getUserOrders } from '../controllers/order.controller.js';

const router = express.Router();

router.use(authenticate);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/orders', getUserOrders);
router.get('/favorites', getFavorites);

export default router;
