import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User.model.js';
import { AuthRequest } from '../middleware/auth.js';

const generateToken = (userId: string, role: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  return jwt.sign({ userId, role }, jwtSecret, { expiresIn: '30d' });
};

// Helper function to check if user is authenticated (optional check)
const checkIfAuthenticated = async (req: Request): Promise<IUser | null> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    if (!token) {
      return null;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; role?: string };
      const user = await User.findById(decoded.userId).select('-password');
      return user;
    } catch (jwtError) {
      return null;
    }
  } catch (error) {
    return null;
  }
};

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Signup request received:', {
      hasPhoneNumber: !!req.body.phoneNumber,
      hasName: !!req.body.name,
      hasPassword: !!req.body.password
    });

    // Check if user is already signed in (optional check - don't block if check fails)
    try {
      const existingAuthUser = await checkIfAuthenticated(req);
      if (existingAuthUser) {
        console.log('User already authenticated, blocking signup');
        res.status(400).json({ 
          success: false, 
          message: 'Та аль хэдийн нэвтэрсэн байна. Гараад дахин оролдоно уу.' 
        });
        return;
      }
    } catch (authCheckError) {
      // If auth check fails, continue with signup (user is not authenticated)
      console.log('Auth check failed (user not authenticated), proceeding with signup');
    }

    const { email, name, password } = req.body;
    const rawPhone = req.body.phone ?? req.body.phoneNumber;

    // Validate all fields are provided and not empty
    if (!rawPhone || !name || !password) {
      const missingFields = [];
      if (!rawPhone) missingFields.push('утасны дугаар');
      if (!name) missingFields.push('нэр');
      if (!password) missingFields.push('нууц үг');
      
      console.log('Missing fields:', missingFields);
      res.status(400).json({ 
        success: false, 
        message: `Бүх талбарыг бөглөнө үү. Дутсан талбарууд: ${missingFields.join(', ')}` 
      });
      return;
    }

    // Check for empty strings after trim
    if (!String(rawPhone).trim() || !name.trim() || !password.trim()) {
      res.status(400).json({ 
        success: false, 
        message: 'Бүх талбарыг бөглөнө үү' 
      });
      return;
    }

    // Normalize phone number and email (same as when saving)
    const cleanPhoneNumber = String(rawPhone).trim().replace(/\s|-/g, '');
    const normalizedEmail = typeof email === 'string' && email.trim()
      ? email.trim().toLowerCase()
      : undefined;
    const trimmedName = name.trim();

    console.log('Normalized values:', {
      cleanPhoneNumber,
      hasEmail: !!normalizedEmail,
      trimmedName,
      passwordLength: password.length
    });

    if (normalizedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        console.log('Invalid email format:', normalizedEmail);
        res.status(400).json({ success: false, message: 'Хүчинтэй имэйл хаяг оруулна уу' });
        return;
      }
    }

    // Validate password: must be exactly 4 digits
    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      console.log('Invalid password format:', password.length, /^\d{4}$/.test(password));
      res.status(400).json({ success: false, message: 'Нууц үг 4 оронтой тоо байх ёстой' });
      return;
    }

    // Validate phone number format (basic check, but NOT verified)
    const phoneRegex = /^[0-9]{8,15}$/;
    if (!phoneRegex.test(cleanPhoneNumber)) {
      console.log('Invalid phone format:', cleanPhoneNumber, 'Length:', cleanPhoneNumber.length);
      res.status(400).json({ success: false, message: 'Хүчинтэй утасны дугаар оруулна уу (8-15 оронтой тоо)' });
      return;
    }

    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail }).select('_id').lean();
      if (existingEmail) {
        res.status(409).json({
          success: false,
          message: 'Энэ имэйл бүртгэлтэй байна',
        });
        return;
      }
    }

    // Duplicate phone
    const existingPhone = await User.findOne({ phoneNumber: cleanPhoneNumber }).select('_id').lean();
    if (existingPhone) {
      res.status(409).json({
        success: false,
        message: 'Энэ утасны дугаар бүртгэлтэй байна',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      phoneNumber: cleanPhoneNumber,
      ...(normalizedEmail ? { email: normalizedEmail } : {}),
      name: trimmedName,
      password: hashedPassword,
      role: 'user',
    });

    console.log('Creating user:', {
      phoneNumber: cleanPhoneNumber,
      hasEmail: !!normalizedEmail,
      name: trimmedName,
      role: 'user'
    });

    try {
      await user.save();
    } catch (saveError: any) {
      // Handle stale auth-index errors from previous deployments.
      if (saveError.message?.includes('clerkld')) {
        console.error('Database index error - stale auth index detected. Please drop the index:', saveError);
        res.status(500).json({
          success: false,
          message: 'Бааз өгөгдлийн алдаа. Админтай холбогдоно уу.'
        });
        return;
      }
      throw saveError; // Re-throw other errors
    }

    const token = generateToken(user._id.toString(), user.role);

    res.status(201).json({
      success: true,
      message: 'Бүртгэл амжилттай',
      token,
      user: {
        id: user._id.toString(),
        phoneNumber: user.phoneNumber,
        email: user.email,
        name: user.name,
        role: user.role,
        address: user.address,
      },
    });
  } catch (error: any) {
    console.error('Sign up error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Handle other MongoDB errors (duplicate key errors should not occur since we removed unique constraints)
    
    // Return proper error response
    const errorMessage = error.message || 'Бүртгэл үүсгэхэд алдаа гарлаа';
    console.error('Returning error response:', errorMessage);
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPhone = req.body.phone ?? req.body.phoneNumber;
    const { password } = req.body;

    if (!rawPhone || !password) {
      res.status(400).json({ success: false, message: 'Утасны дугаар болон нууц үг оруулна уу' });
      return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      res.status(400).json({ success: false, message: 'Нууц үг 4 оронтой тоо байх ёстой' });
      return;
    }

    const cleanPhoneNumber = String(rawPhone).trim().replace(/\s|-/g, '');

    const user = await User.findOne({ phoneNumber: cleanPhoneNumber })
      .select('_id phoneNumber email name role address password')
      .maxTimeMS(5000)
      .lean();

    if (!user) {
      res.status(401).json({ success: false, message: 'Утасны дугаар эсвэл нууц үг буруу байна' });
      return;
    }

    // Legacy rows may be missing a local password hash.
    if (!user.password) {
      res.status(401).json({ success: false, message: 'Утасны дугаар эсвэл нууц үг буруу байна' });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ success: false, message: 'Утасны дугаар эсвэл нууц үг буруу байна' });
      return;
    }

    const token = generateToken(user._id.toString(), user.role);

    res.json({
      success: true,
      message: 'Нэвтрэх амжилттай',
      token,
      user: {
        id: user._id.toString(),
        phoneNumber: user.phoneNumber,
        email: user.email,
        name: user.name,
        role: user.role,
        address: user.address,
      },
    });
  } catch (error: any) {
    console.error('❌ Sign in error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Нэвтрэхэд алдаа гарлаа'
    });
  }
};
