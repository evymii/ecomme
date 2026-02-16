import express from 'express';
import { signUp, signIn, checkEmail, clerkSync } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/check-email', checkEmail);
router.post('/clerk-sync', clerkSync);

export default router;
