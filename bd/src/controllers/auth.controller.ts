import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User, { IUser } from '../models/User.model.js';
import { AuthRequest } from '../middleware/auth.js';

const generateToken = (userId: string): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not set in environment variables');
  }
  // 1 month = 30 days
  return jwt.sign({ userId }, jwtSecret, { expiresIn: '30d' });
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
      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
      const user = await User.findById(decoded.userId).select('-password');
      return user;
    } catch (jwtError) {
      // Try backward compatibility (user ID as token)
      try {
        const user = await User.findById(token).select('-password');
        return user;
      } catch (e) {
        return null;
      }
    }
  } catch (error) {
    return null;
  }
};

export const signUp = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Signup request received:', {
      body: req.body,
      hasPhoneNumber: !!req.body.phoneNumber,
      hasEmail: !!req.body.email,
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

    const { phoneNumber, email, name, password, emailVerified } = req.body;

    // Validate all fields are provided and not empty
    if (!phoneNumber || !email || !name || !password) {
      const missingFields = [];
      if (!phoneNumber) missingFields.push('утасны дугаар');
      if (!email) missingFields.push('имэйл');
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
    if (!phoneNumber.trim() || !email.trim() || !name.trim() || !password.trim()) {
      res.status(400).json({ 
        success: false, 
        message: 'Бүх талбарыг бөглөнө үү' 
      });
      return;
    }

    // Normalize phone number and email (same as when saving)
    const cleanPhoneNumber = phoneNumber.trim().replace(/\s|-/g, '');
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    console.log('Normalized values:', {
      cleanPhoneNumber,
      normalizedEmail,
      trimmedName,
      passwordLength: password.length
    });

    // Validate email format (email will be verified, phone number is NOT verified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      console.log('Invalid email format:', normalizedEmail);
      res.status(400).json({ success: false, message: 'Хүчинтэй имэйл хаяг оруулна уу' });
      return;
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

    // No duplicate check - allow multiple users with same email/phone number

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token if not already verified by Clerk
    const emailVerificationToken = emailVerified ? undefined : crypto.randomBytes(32).toString('hex');

    // Create user in database
    // First user with specific email becomes admin, or you can set manually
    const isFirstAdmin = normalizedEmail === 'n.munkhpurev@gmail.com' || normalizedEmail === 'admin@example.com';
    const user = new User({
      phoneNumber: cleanPhoneNumber,
      email: normalizedEmail,
      name: trimmedName,
      password: hashedPassword,
      role: isFirstAdmin ? 'admin' : 'user',
      isEmailVerified: emailVerified === true, // true if Clerk verified the email
      emailVerificationToken
    });

    console.log('Creating user:', {
      phoneNumber: cleanPhoneNumber,
      email: normalizedEmail,
      name: trimmedName,
      role: isFirstAdmin ? 'admin' : 'user'
    });

    try {
      await user.save();
    } catch (saveError: any) {
      // Handle old index errors (like clerkld) - but allow duplicates
      if (saveError.message?.includes('clerkld')) {
        console.error('Database index error - old clerkld index detected. Please drop the index:', saveError);
        res.status(500).json({
          success: false,
          message: 'Бааз өгөгдлийн алдаа. Админтай холбогдоно уу.'
        });
        return;
      }
      throw saveError; // Re-throw other errors
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

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
        address: user.address
      }
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

export const checkEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.json({ success: true, exists: false });
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail }).select('_id').lean();
    res.json({ success: true, exists: !!user });
  } catch (error: any) {
    res.json({ success: true, exists: false });
  }
};

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, password } = req.body;

    console.log('Sign in request received:', {
      hasPhoneNumber: !!phoneNumber,
      hasPassword: !!password,
      phoneNumberLength: phoneNumber?.length,
      passwordLength: password?.length
    });

    if (!phoneNumber || !password) {
      console.log('Missing phone number or password');
      res.status(400).json({ success: false, message: 'Утасны дугаар болон нууц үг оруулна уу' });
      return;
    }

    // Validate password format
    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      console.log('Invalid password format:', password.length, /^\d{4}$/.test(password));
      res.status(400).json({ success: false, message: 'Нууц үг 4 оронтой тоо байх ёстой' });
      return;
    }

    // Clean phone number (remove spaces/dashes) - phone number is NOT verified, just used for login
    const cleanPhoneNumber = phoneNumber.trim().replace(/\s|-/g, '');
    console.log('Cleaned phone number:', cleanPhoneNumber);

    // Find user by phone number (login uses phone number, not email)
    const user = await User.findOne({ phoneNumber: cleanPhoneNumber });
    console.log('User found:', !!user, user ? { id: user._id.toString(), phoneNumber: user.phoneNumber } : null);
    
    if (!user) {
      console.log('User not found with phone number:', cleanPhoneNumber);
      res.status(401).json({ success: false, message: 'Утасны дугаар эсвэл нууц үг буруу байна' });
      return;
    }

    // Verify password (4-digit password)
    console.log('Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', user._id.toString());
      res.status(401).json({ success: false, message: 'Утасны дугаар эсвэл нууц үг буруу байна' });
      return;
    }

    // Note: Email verification is not required for login
    // Phone number is used for login, email is for verification (but not enforced on login)

    // Generate JWT token
    const token = generateToken(user._id.toString());
    console.log('✅ Sign in successful for user:', user._id.toString(), user.name);

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
        address: user.address
      }
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

// ========== CLERK SYNC ==========
// Called after Clerk authentication to create/find user in our DB and return our JWT
export const clerkSync = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber, name } = req.body;

    if (!email && !phoneNumber) {
      res.status(400).json({ success: false, message: 'Имэйл эсвэл утасны дугаар шаардлагатай' });
      return;
    }

    const normalizedEmail = email ? email.trim().toLowerCase() : '';
    const cleanPhoneNumber = phoneNumber ? phoneNumber.trim().replace(/\s|-/g, '') : '';
    const trimmedName = name ? name.trim() : '';

    // Try to find existing user by email or phone number
    let user = null;

    if (normalizedEmail) {
      user = await User.findOne({ email: normalizedEmail });
    }
    
    if (!user && cleanPhoneNumber) {
      user = await User.findOne({ phoneNumber: cleanPhoneNumber });
    }

    if (user) {
      // Update existing user info if needed
      let needsUpdate = false;
      
      if (normalizedEmail && user.email !== normalizedEmail) {
        user.email = normalizedEmail;
        needsUpdate = true;
      }
      if (cleanPhoneNumber && user.phoneNumber !== cleanPhoneNumber) {
        user.phoneNumber = cleanPhoneNumber;
        needsUpdate = true;
      }
      if (trimmedName && !user.name) {
        user.name = trimmedName;
        needsUpdate = true;
      }
      if (!user.isEmailVerified) {
        user.isEmailVerified = true;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
      }
    } else {
      // Create new user
      const isFirstAdmin = normalizedEmail === 'n.munkhpurev@gmail.com' || normalizedEmail === 'admin@example.com';
      
      user = new User({
        phoneNumber: cleanPhoneNumber || 'not-set',
        email: normalizedEmail || 'not-set@example.com',
        name: trimmedName || 'Хэрэглэгч',
        password: 'clerk-managed',
        role: isFirstAdmin ? 'admin' : 'user',
        isEmailVerified: true,
      });

      await user.save();
    }

    // Generate our JWT token
    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      message: 'Sync амжилттай',
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
    console.error('Clerk sync error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Sync алдаа гарлаа',
    });
  }
};
