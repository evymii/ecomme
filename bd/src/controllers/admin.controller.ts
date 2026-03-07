import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';
import { bufferToDataURL, generateFileName, saveFileLocally } from '../utils/fileUtils.js';

// Simple admin check endpoint - fast and lightweight
export const checkAdminAuth = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // This endpoint is protected by authenticate + requireAdmin middleware
    // If we reach here, user is authenticated and is admin
    res.json({
      success: true,
      isAdmin: true,
      user: {
        id: req.userId,
        role: req.userRole
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    const orders = await Order.find();
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        revenue
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Optimize: use lean() for faster queries
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();
    
    // No cache for admin data - must always be fresh
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'user'].includes(role)) {
      res.status(400).json({ success: false, message: 'Буруу эрх' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй' });
      return;
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: 'Хэрэглэгчийн эрх амжилттай шинэчлэгдлээ',
      user
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.userId) {
      res.status(400).json({ success: false, message: 'Та өөрийгөө устгах боломжгүй' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй' });
      return;
    }

    await User.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Хэрэглэгч амжилттай устгалаа',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeUserPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, message: 'Нууц үг оруулна уу' });
      return;
    }

    // Validate: 4-digit numeric PIN
    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      res.status(400).json({ success: false, message: 'Нууц үг 4 оронтой тоо байх ёстой' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Нууц үг амжилттай солигдлоо',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Return lightweight list data for admin grid; full product data is fetched on edit.
    const products = await Product.find()
      .select('code name description price category stock images features createdAt')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .lean();
    
    // Set cache headers
    res.setHeader('Cache-Control', 'private, max-age=30');
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, description, price, category, stock, features, mainImageIndex, sizes } = req.body;

    if (!code || !name || !description || !price || !category || stock === undefined) {
      res.status(400).json({ 
        success: false, 
        message: 'Бүх талбарыг бөглөнө үү'
      });
      return;
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, message: 'Хамгийн багадаа 1 зураг оруулна уу' });
      return;
    }

    // Parse features if it's a string
    let parsedFeatures: any = {
      isNew: false,
      isFeatured: false,
      isDiscounted: false
    };

    if (features) {
      try {
        parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;
      } catch (e) {
        console.error('Error parsing features:', e);
      }
    }

    const toBoolean = (value: any): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
      return Boolean(value);
    };

    const mainIdx = parseInt(mainImageIndex || '0', 10);
    
    // For Vercel/serverless, use base64 data URLs
    // For local development, save files to disk
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    const productImages = await Promise.all(
      files.map(async (file, index) => {
        let imageUrl: string;
        
        if (isProduction) {
          // Use base64 data URL for serverless
          imageUrl = file.buffer ? bufferToDataURL(file.buffer, file.mimetype) : '';
        } else {
          // Save to local disk for development
          const filename = generateFileName(file.originalname);
          imageUrl = await saveFileLocally(file.buffer, filename, 'products');
        }
        
        return {
          url: imageUrl,
          isMain: index === mainIdx,
          order: index
        };
      })
    );

    // Parse sizes if it's a string
    let parsedSizes: string[] = [];
    if (sizes) {
      try {
        parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      } catch (e) {
        console.error('Error parsing sizes:', e);
      }
    }

    const product = new Product({
      code: code.toString().trim(),
      name: name.toString().trim(),
      description: description.toString().trim(),
      price: parseFloat(price.toString()),
      category: category.toString().trim(),
      stock: parseInt(stock.toString(), 10),
      sizes: parsedSizes.length > 0 ? parsedSizes : undefined,
      images: productImages,
      features: {
        isNew: toBoolean(parsedFeatures.isNew),
        isFeatured: toBoolean(parsedFeatures.isFeatured),
        isDiscounted: toBoolean(parsedFeatures.isDiscounted)
      }
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Бараа амжилттай нэмэгдлээ',
      product
    });
  } catch (error: any) {
    console.error('Create product error:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Энэ кодтой бараа аль хэдийн байна' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Бараа нэмэхэд алдаа гарлаа' });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, name, description, price, category, stock, features, mainImageIndex, sizes, existingImages } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Бараа олдсонгүй' });
      return;
    }

    const files = req.files as Express.Multer.File[];
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

    // Handle images: merge existing images with new ones, or use existing if no new files
    if (files && files.length > 0) {
      // New files uploaded - process them
      const mainIdx = parseInt(mainImageIndex || '0', 10);
      const newImages = await Promise.all(
        files.map(async (file, index) => {
          let imageUrl: string;
          
          if (isProduction) {
            imageUrl = file.buffer ? bufferToDataURL(file.buffer, file.mimetype) : '';
          } else {
            const filename = generateFileName(file.originalname);
            imageUrl = await saveFileLocally(file.buffer, filename, 'products');
          }
          
          return {
            url: imageUrl,
            isMain: false, // Will be set based on mainImageIndex later
            order: index
          };
        })
      );

      // Parse existing images if provided
      let parsedExistingImages: any[] = [];
      if (existingImages) {
        try {
          parsedExistingImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
        } catch (e) {
          console.error('Error parsing existing images:', e);
        }
      }

      // Merge existing and new images, then set main image
      // mainImageIndex refers to the final combined array
      const allImages = [...parsedExistingImages, ...newImages];
      const finalMainIdx = parseInt(mainImageIndex || '0', 10);
      // Ensure main index is within bounds
      const safeMainIdx = Math.max(0, Math.min(finalMainIdx, allImages.length - 1));
      product.images = allImages.map((img, idx) => ({
        url: (typeof img === 'string' ? img : (img.url || '')),
        isMain: idx === safeMainIdx,
        order: idx
      }));
    } else if (existingImages) {
      // No new files, but existing images data provided - update existing images order/main
      try {
        const parsedExistingImages = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
        if (Array.isArray(parsedExistingImages) && parsedExistingImages.length > 0) {
          const finalMainIdx = parseInt(mainImageIndex || '0', 10);
          // Ensure main index is within bounds
          const safeMainIdx = Math.max(0, Math.min(finalMainIdx, parsedExistingImages.length - 1));
          product.images = parsedExistingImages.map((img: any, idx: number) => ({
            url: (typeof img === 'string' ? img : img.url) || '',
            isMain: idx === safeMainIdx,
            order: idx
          }));
        }
      } catch (e) {
        console.error('Error parsing existing images:', e);
        // Keep existing images if parsing fails, but update main image if needed
        if (mainImageIndex !== undefined && product.images && product.images.length > 0) {
          const finalMainIdx = parseInt(mainImageIndex || '0', 10);
          const safeMainIdx = Math.max(0, Math.min(finalMainIdx, product.images.length - 1));
          product.images = product.images.map((img: any, idx: number) => ({
            ...img,
            isMain: idx === safeMainIdx,
            order: idx
          }));
        }
      }
    }
    // If neither files nor existingImages provided, keep current images (but update main image if needed)
    else if (mainImageIndex !== undefined) {
      // Only update main image index if provided
      const finalMainIdx = parseInt(mainImageIndex || '0', 10);
      if (product.images && product.images.length > 0) {
        const safeMainIdx = Math.max(0, Math.min(finalMainIdx, product.images.length - 1));
        product.images = product.images.map((img: any, idx: number) => ({
          ...img,
          isMain: idx === safeMainIdx,
          order: idx
        }));
      }
    }

    if (code) product.code = code.toString().trim();
    if (name) product.name = name.toString().trim();
    if (description) product.description = description.toString().trim();
    if (price) product.price = parseFloat(price.toString());
    if (category) product.category = category.toString().trim();
    if (stock !== undefined) product.stock = parseInt(stock.toString(), 10);
    
    if (sizes !== undefined) {
      try {
        const parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
        product.sizes = Array.isArray(parsedSizes) ? parsedSizes : [];
      } catch (e) {
        console.error('Error parsing sizes:', e);
      }
    }

    if (features) {
      try {
        const parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;
        const toBoolean = (value: any): boolean => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'string') return value === 'true';
          return Boolean(value);
        };
        product.features = {
          isNew: toBoolean(parsedFeatures.isNew),
          isFeatured: toBoolean(parsedFeatures.isFeatured),
          isDiscounted: toBoolean(parsedFeatures.isDiscounted)
        };
      } catch (e) {
        console.error('Error parsing features:', e);
      }
    }

    await product.save();

    res.json({
      success: true,
      message: 'Бараа амжилттай шинэчлэгдлээ',
      product
    });
  } catch (error: any) {
    console.error('Update product error:', error);
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Энэ кодтой бараа аль хэдийн байна' });
      return;
    }
    res.status(500).json({ success: false, message: error.message || 'Бараа шинэчлэхэд алдаа гарлаа' });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      res.status(404).json({ success: false, message: 'Бараа олдсонгүй' });
      return;
    }

    res.json({ success: true, message: 'Бараа амжилттай устгалаа' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, orderCode, phoneNumber, search } = req.query;
    const andConditions: any[] = [];
    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const createdAtFilter: any = {};

    if (startDate || endDate) {
      if (startDate) {
        // Set to start of day (00:00:00.000) in local timezone
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        createdAtFilter.$gte = start;
      }
      if (endDate) {
        // Set to end of day (23:59:59.999) in local timezone to include all orders on that day
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        createdAtFilter.$lte = end;
      }
      andConditions.push({ createdAt: createdAtFilter });
    }

    const buildPhoneConditions = async (rawPhone: string) => {
      const phoneRegex = new RegExp(escapeRegex(rawPhone), 'i');
      const matchedUsers = await User.find({ phoneNumber: { $regex: phoneRegex } })
        .select('_id')
        .limit(100)
        .lean();
      const matchedUserIds = matchedUsers.map((u: any) => u._id);

      const phoneConditions: any[] = [{ phoneNumber: { $regex: phoneRegex } }];
      if (matchedUserIds.length > 0) {
        phoneConditions.push({ user: { $in: matchedUserIds } });
      }
      return phoneConditions;
    };

    const searchQuery = typeof search === 'string' ? search.trim() : '';
    if (searchQuery) {
      const searchConditions: any[] = [
        { orderCode: { $regex: escapeRegex(searchQuery), $options: 'i' } },
        ...(await buildPhoneConditions(searchQuery)),
      ];
      andConditions.push({ $or: searchConditions });
    } else {
      const orderCodeQuery = typeof orderCode === 'string' ? orderCode.trim() : '';
      if (orderCodeQuery) {
        andConditions.push({
          orderCode: { $regex: escapeRegex(orderCodeQuery), $options: 'i' },
        });
      }

      const phoneQuery = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
      if (phoneQuery) {
        andConditions.push({ $or: await buildPhoneConditions(phoneQuery) });
      }
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    console.log('📋 Fetching orders for admin with query:', query);
    if (startDate && createdAtFilter.$gte) console.log('📅 Start date:', createdAtFilter.$gte);
    if (endDate && createdAtFilter.$lte) console.log('📅 End date:', createdAtFilter.$lte);

    // Optimize: use lean() and select only needed fields for faster queries
    // Use select() on populate to reduce data transfer
    const orders = await Order.find(query)
      .select('orderCode items total status createdAt phoneNumber email customerName user deliveryAddress paymentMethod address payment')
      .populate('user', 'name phoneNumber email')
      .populate('items.product', 'name price code')
      .sort({ createdAt: -1 })
      .limit(500) // Limit orders to prevent huge responses
      .lean();

    // Normalize legacy documents so admin UI always receives these fields.
    const normalizedOrders = orders.map((order: any) => {
      const normalizedDeliveryAddress = order.deliveryAddress?.address
        ? order.deliveryAddress
        : typeof order.deliveryAddress === 'string'
          ? { address: order.deliveryAddress }
          : typeof order.address === 'string'
            ? { address: order.address }
            : order.address?.deliveryAddress
              ? { address: order.address.deliveryAddress, additionalInfo: order.address.additionalInfo || '' }
              : undefined;

      const normalizedPaymentMethod =
        order.paymentMethod ||
        order.payment?.method ||
        order.payment?.paymentMethod ||
        'pay_later';

      return {
        ...order,
        deliveryAddress: normalizedDeliveryAddress,
        paymentMethod: normalizedPaymentMethod,
      };
    });

    console.log(`✅ Found ${normalizedOrders.length} orders for admin`);

    // Set cache headers
    res.setHeader('Cache-Control', 'private, max-age=10');
    res.json({ success: true, orders: normalizedOrders });
  } catch (error: any) {
    console.error('❌ Error fetching orders for admin:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: 'Буруу статус' });
      return;
    }

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });
      return;
    }

    order.status = status;
    await order.save();

    res.json({
      success: true,
      message: 'Захиалгын статус амжилттай шинэчлэгдлээ',
      order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
