import express from 'express';
import { signUp, signIn, checkEmail } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/signup', signUp);
router.post('/signin', signIn);
router.post('/check-email', checkEmail);

export default router;
