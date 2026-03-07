import express from 'express';
import { getHomeData } from '../controllers/public.controller.js';

const router = express.Router();

router.get('/home', getHomeData);

export default router;
