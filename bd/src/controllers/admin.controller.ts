import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';
import { deleteFromCloudinary } from '../utils/fileUtils.js';

type ProductImageInput = {
  url: string;
  isMain?: boolean;
  order?: number;
};

function normalizeProductImages(images: ProductImageInput[]) {
  return images.map((img, idx) => {
    const url = typeof img?.url === 'string' ? img.url.trim() : '';
    if (!url) {
      throw new Error('Зургийн URL дутуу байна');
    }
    // Prevent huge payloads and slow responses from base64 image blobs in Mongo.
    if (url.startsWith('data:image/')) {
      throw new Error('Base64 зураг дэмжихгүй. Cloudinary URL ашиглана уу');
    }
    if (url.length > 5000) {
      throw new Error('Зургийн URL хэт урт байна');
    }

    return {
      url,
      isMain: !!img?.isMain,
      order: img?.order ?? idx,
    };
  });
}

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
    const [totalUsers, totalProducts, revenueResult] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.aggregate([
        {
          $group: {
            _id: null,
            revenue: { $sum: '$total' },
            count: { $sum: 1 },
          },
        },
      ]).option({ maxTimeMS: 5000 }),
    ]);

    const stats = revenueResult[0] || { revenue: 0, count: 0 };

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalProducts,
        totalOrders: stats.count,
        revenue: stats.revenue,
      },
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
    const { code, name, description, price, category, stock, features, images, sizes } = req.body;

    if (!code || !name || !description || !price || !category || stock === undefined) {
      res.status(400).json({
        success: false,
        message: 'Бүх талбарыг бөглөнө үү'
      });
      return;
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      res.status(400).json({ success: false, message: 'Хамгийн багадаа 1 зураг оруулна уу' });
      return;
    }

    const toBoolean = (value: any): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
      return Boolean(value);
    };

    // Parse features
    let parsedFeatures = features || {};
    if (typeof parsedFeatures === 'string') {
      try { parsedFeatures = JSON.parse(parsedFeatures); } catch { parsedFeatures = {}; }
    }

    // Images come as array of { url, isMain, order } from frontend
    const productImages = normalizeProductImages(images as ProductImageInput[]);

    // Parse sizes
    let parsedSizes: string[] = [];
    if (sizes) {
      try {
        parsedSizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
      } catch { /* ignore */ }
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
    const { code, name, description, price, category, stock, features, images, sizes } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Бараа олдсонгүй' });
      return;
    }

    const toBoolean = (value: any): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'string') return value === 'true';
      return Boolean(value);
    };

    // Images come as JSON array of { url, isMain, order }
    if (images && Array.isArray(images) && images.length > 0) {
      product.images = normalizeProductImages(images as ProductImageInput[]);
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
      } catch { /* ignore */ }
    }

    if (features) {
      let parsedFeatures = features;
      if (typeof parsedFeatures === 'string') {
        try { parsedFeatures = JSON.parse(parsedFeatures); } catch { parsedFeatures = {}; }
      }
      product.features = {
        isNew: toBoolean(parsedFeatures.isNew),
        isFeatured: toBoolean(parsedFeatures.isFeatured),
        isDiscounted: toBoolean(parsedFeatures.isDiscounted)
      };
    }

    await product.save();

    res.json({
      success: true,
      message: 'Бараа амжилттай шинэчлэгдлээ',
      product
    });
  } catch (error: any) {
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

    // Delete images from Cloudinary in background
    if (product.images && product.images.length > 0) {
      Promise.all(
        product.images.map((img: any) => deleteFromCloudinary(img.url))
      ).catch(err => console.error('Cloudinary cleanup error:', err));
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
    const parseDateSafe = (value: unknown, endOfDay = false): Date | null => {
      if (!value || typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymdMatch) {
        const year = Number(ymdMatch[1]);
        const month = Number(ymdMatch[2]);
        const day = Number(ymdMatch[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        const parsed = new Date(year, month - 1, day);
        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.getFullYear() !== year ||
          parsed.getMonth() !== month - 1 ||
          parsed.getDate() !== day
        ) {
          return null;
        }
        if (endOfDay) parsed.setHours(23, 59, 59, 999);
        else parsed.setHours(0, 0, 0, 0);
        return parsed;
      }

      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return null;
      if (endOfDay) parsed.setHours(23, 59, 59, 999);
      else parsed.setHours(0, 0, 0, 0);
      return parsed;
    };

    const createdAtFilter: any = {};

    if (startDate || endDate) {
      if (startDate) {
        const start = parseDateSafe(startDate);
        if (!start) {
          res.status(400).json({ success: false, message: 'Эхлэх огнооны формат буруу байна' });
          return;
        }
        createdAtFilter.$gte = start;
      }
      if (endDate) {
        const end = parseDateSafe(endDate, true);
        if (!end) {
          res.status(400).json({ success: false, message: 'Дуусах огнооны формат буруу байна' });
          return;
        }
        createdAtFilter.$lte = end;
      }
      if (createdAtFilter.$gte && createdAtFilter.$lte && createdAtFilter.$gte > createdAtFilter.$lte) {
        res.status(400).json({ success: false, message: 'Эхлэх огноо дуусах огнооноос хойш байж болохгүй' });
        return;
      }
      andConditions.push({ createdAt: createdAtFilter });
    }

    const buildPrefixRegex = (value: string) => new RegExp(`^${escapeRegex(value)}`, 'i');
    const buildExactRegex = (value: string) => new RegExp(`^${escapeRegex(value)}$`, 'i');
    const isLikelyPhoneNumber = (value: string) => /^\d{8,}$/.test(value);

    const buildPhoneConditions = async (rawPhone: string) => {
      const cleanedPhone = rawPhone.replace(/\s+/g, '');
      const useExactMatch = isLikelyPhoneNumber(cleanedPhone);
      const phoneRegex = useExactMatch ? buildExactRegex(cleanedPhone) : buildPrefixRegex(cleanedPhone);
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
      const cleanedSearch = searchQuery.replace(/\s+/g, '');
      // If input looks like a full phone number, only search by phone to avoid broad order-code matches.
      if (isLikelyPhoneNumber(cleanedSearch)) {
        andConditions.push({ $or: await buildPhoneConditions(cleanedSearch) });
      } else {
        const searchConditions: any[] = [
          {
            orderCode: {
              $regex: buildPrefixRegex(cleanedSearch),
            },
          },
          ...(await buildPhoneConditions(cleanedSearch)),
        ];
        andConditions.push({ $or: searchConditions });
      }
    } else {
      const orderCodeQuery = typeof orderCode === 'string' ? orderCode.trim() : '';
      if (orderCodeQuery) {
        const cleanedOrderCode = orderCodeQuery.replace(/\s+/g, '');
        andConditions.push({
          orderCode: {
            $regex: isLikelyPhoneNumber(cleanedOrderCode)
              ? buildExactRegex(cleanedOrderCode)
              : buildPrefixRegex(cleanedOrderCode),
          },
        });
      }

      const phoneQuery = typeof phoneNumber === 'string' ? phoneNumber.trim() : '';
      if (phoneQuery) {
        andConditions.push({ $or: await buildPhoneConditions(phoneQuery) });
      }
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    // Read raw refs first; manual enrichment avoids populate cast crashes on legacy/corrupt docs.
    const orders = await Order.find(query)
      .select('orderCode items total status createdAt phoneNumber email customerName user deliveryAddress paymentMethod address payment')
      .sort({ createdAt: -1 })
      .limit(500) // Limit orders to prevent huge responses
      .lean();

    // Normalize legacy documents so admin UI always receives these fields.
    const normalizedOrders = (orders as any[]).map((order: any) => {
      const normalizedOrderCode =
        typeof order.orderCode === 'string' && order.orderCode.length > 5
          ? order.orderCode.slice(-5)
          : order.orderCode;

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

      const normalizedItems = Array.isArray(order.items)
        ? order.items.map((item: any) => {
            return {
              ...item,
              product:
                item?.product && typeof item.product === 'object'
                  ? item.product
                  : null,
            };
          })
        : [];

      return {
        ...order,
        user: order.user && typeof order.user === 'object' ? order.user : undefined,
        items: normalizedItems,
        orderCode: normalizedOrderCode,
        deliveryAddress: normalizedDeliveryAddress,
        paymentMethod: normalizedPaymentMethod,
      };
    });

    // Set cache headers
    res.setHeader('Cache-Control', 'private, max-age=10');
    res.json({ success: true, orders: normalizedOrders });
  } catch (error: any) {
    console.error('❌ Error fetching orders for admin:', {
      message: error?.message,
      stack: error?.stack,
      query: req.query,
    });
    res.status(500).json({ success: false, message: 'Захиалга авахад серверийн алдаа гарлаа' });
  }
};

export const getOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = typeof req.params?.id === 'string' ? req.params.id : '';
    const id = rawId.trim();
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Захиалгын ID буруу байна' });
      return;
    }

    const order = await Order.findById(id)
      .select('orderCode items total status createdAt phoneNumber email customerName user deliveryAddress paymentMethod address payment')
      .lean();

    if (!order) {
      res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });
      return;
    }

    const userId =
      order.user && mongoose.isValidObjectId(order.user)
        ? String(order.user)
        : null;
    const productIds = Array.isArray(order.items)
      ? order.items
          .map((item: any) => item?.product)
          .filter((pid: any) => pid && mongoose.isValidObjectId(pid))
          .map((pid: any) => String(pid))
      : [];

    const [user, products] = await Promise.all([
      userId
        ? User.findById(userId).select('name phoneNumber email').lean()
        : Promise.resolve(null),
      productIds.length > 0
        ? Product.find({ _id: { $in: productIds } })
            .select('name price code images')
            .lean()
        : Promise.resolve([]),
    ]);

    const productMap = new Map<string, any>(
      (products as any[]).map((p: any) => [String(p._id), p])
    );

    const normalizedOrderCode =
      typeof (order as any).orderCode === 'string' && (order as any).orderCode.length > 5
        ? (order as any).orderCode.slice(-5)
        : (order as any).orderCode;

    const normalizedDeliveryAddress = (order as any).deliveryAddress?.address
      ? (order as any).deliveryAddress
      : typeof (order as any).deliveryAddress === 'string'
        ? { address: (order as any).deliveryAddress }
        : typeof (order as any).address === 'string'
          ? { address: (order as any).address }
          : (order as any).address?.deliveryAddress
            ? { address: (order as any).address.deliveryAddress, additionalInfo: (order as any).address.additionalInfo || '' }
            : undefined;

    const normalizedPaymentMethod =
      (order as any).paymentMethod ||
      (order as any).payment?.method ||
      (order as any).payment?.paymentMethod ||
      'pay_later';

    const normalizedItems = Array.isArray((order as any).items)
      ? (order as any).items.map((item: any) => {
          const productId =
            item?.product && mongoose.isValidObjectId(item.product)
              ? String(item.product)
              : null;
          const productDoc = productId ? productMap.get(productId) : null;
          return {
            ...item,
            product: productDoc || (item?.product && typeof item.product === 'object' ? item.product : null),
          };
        })
      : [];

    const responseOrder = {
      ...(order as any),
      user: user || undefined,
      items: normalizedItems,
      orderCode: normalizedOrderCode,
      deliveryAddress: normalizedDeliveryAddress,
      paymentMethod: normalizedPaymentMethod,
    };

    res.json({ success: true, order: responseOrder });
  } catch (error: any) {
    console.error('❌ Error fetching order details for admin:', {
      message: error?.message,
      stack: error?.stack,
      orderId: req.params?.id,
    });
    res.status(500).json({ success: false, message: 'Захиалгын дэлгэрэнгүй авахад серверийн алдаа гарлаа' });
  }
};

export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawId = typeof req.params?.id === 'string' ? req.params.id : '';
    const id = rawId.trim();
    if (!id || !mongoose.isValidObjectId(id)) {
      res.status(400).json({ success: false, message: 'Захиалгын ID буруу байна' });
      return;
    }
    const deleteResult = await Order.collection.deleteOne({
      _id: new mongoose.Types.ObjectId(id),
    });
    if (!deleteResult.deletedCount) {
      res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });
      return;
    }

    res.json({ success: true, message: 'Захиалга амжилттай устгагдлаа' });
  } catch (error: any) {
    console.error('❌ Delete single order error:', {
      message: error?.message,
      stack: error?.stack,
      orderId: req.params?.id,
    });
    res.status(500).json({
      success: false,
      message: error?.message || 'Захиалга устгахад серверийн алдаа гарлаа',
    });
  }
};

export const deleteOrderHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const query = req.query || {};
    const mode = (body.mode ?? query.mode) as string | undefined;
    const orderIdsInput = body.orderIds ?? query.orderIds;
    const startDate = (body.startDate ?? query.startDate) as string | undefined;
    const endDate = (body.endDate ?? query.endDate) as string | undefined;
    const normalizedMode =
      typeof mode === 'string'
        ? (mode.trim().toLowerCase() as 'all' | 'range' | 'selected')
        : 'range';
    const deleteQuery: any = {};
    const parseDateSafe = (value: any, endOfDay = false): Date | null => {
      if (!value || typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;

      // Prefer explicit YYYY-MM-DD parsing to avoid runtime/environment differences.
      const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (ymdMatch) {
        const year = Number(ymdMatch[1]);
        const month = Number(ymdMatch[2]);
        const day = Number(ymdMatch[3]);
        if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;

        const parsed = new Date(year, month - 1, day);
        if (Number.isNaN(parsed.getTime())) return null;
        if (
          parsed.getFullYear() !== year ||
          parsed.getMonth() !== month - 1 ||
          parsed.getDate() !== day
        ) {
          return null;
        }

        if (endOfDay) {
          parsed.setHours(23, 59, 59, 999);
        } else {
          parsed.setHours(0, 0, 0, 0);
        }
        return parsed;
      }

      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) return null;
      if (endOfDay) {
        parsed.setHours(23, 59, 59, 999);
      } else {
        parsed.setHours(0, 0, 0, 0);
      }
      return parsed;
    };

    if (normalizedMode === 'selected') {
      const ids =
        Array.isArray(orderIdsInput)
          ? orderIdsInput
          : typeof orderIdsInput === 'string'
            ? orderIdsInput.split(',')
            : [];

      const sanitizedIds = Array.from(
        new Set(
          ids
            .map((id: any) => String(id || '').trim())
            .filter((id: string) => mongoose.isValidObjectId(id))
        )
      );

      if (sanitizedIds.length === 0) {
        res.status(400).json({ success: false, message: 'Устгах захиалгууд сонгоогүй байна' });
        return;
      }

      const objectIds = sanitizedIds.map((id) => new mongoose.Types.ObjectId(id));
      const result = await Order.collection.deleteMany({ _id: { $in: objectIds } });
      res.json({
        success: true,
        message: 'Сонгосон захиалгууд амжилттай устгагдлаа',
        deletedCount: result.deletedCount || 0,
      });
      return;
    }

    if (normalizedMode === 'range') {
      const start = parseDateSafe(startDate);
      const end = parseDateSafe(endDate, true);

      if (!start && !end) {
        res.status(400).json({ success: false, message: 'Эхлэх болон дуусах огноогоо зөв оруулна уу' });
        return;
      }

      if (startDate && !start) {
        res.status(400).json({ success: false, message: 'Эхлэх огнооны формат буруу байна' });
        return;
      }

      if (endDate && !end) {
        res.status(400).json({ success: false, message: 'Дуусах огнооны формат буруу байна' });
        return;
      }

      if (start && end && start > end) {
        res.status(400).json({ success: false, message: 'Эхлэх огноо дуусах огнооноос хойш байж болохгүй' });
        return;
      }

      deleteQuery.createdAt = {};
      if (start) {
        deleteQuery.createdAt.$gte = start;
      }
      if (end) {
        deleteQuery.createdAt.$lte = end;
      }
    }

    if (normalizedMode === 'all') {
      const result = await Order.collection.deleteMany({});
      res.json({
        success: true,
        message: 'Бүх захиалгын түүх амжилттай устгагдлаа',
        deletedCount: result.deletedCount || 0,
      });
      return;
    }

    const matchingCount = await Order.countDocuments(deleteQuery);
    if (!matchingCount) {
      res.json({
        success: true,
        message: 'Сонгосон хугацаанд устгах захиалга олдсонгүй',
        deletedCount: 0,
      });
      return;
    }

    // Delete directly by date query for better performance on serverless runtime limits.
    const result = await Order.collection.deleteMany(deleteQuery);

    res.json({
      success: true,
      message: 'Сонгосон хугацааны захиалгын түүх амжилттай устгагдлаа',
      deletedCount: result.deletedCount || 0,
    });
  } catch (error: any) {
    console.error('❌ Delete order history error:', {
      message: error?.message,
      stack: error?.stack,
      query: req.query,
      body: req.body,
    });
    const isTimeoutError =
      error?.name === 'MongoServerError' && /time limit|exceeded/i.test(error?.message || '');
    if (isTimeoutError) {
      res.status(503).json({
        success: false,
        message: 'Устгалт удааширлаа. Дахин оролдоно уу (сервер ачаалалтай байна).',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: error?.message || 'Захиалгын түүх устгахад серверийн алдаа гарлаа',
    });
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

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!order) {
      res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });
      return;
    }

    res.json({
      success: true,
      message: 'Захиалгын статус амжилттай шинэчлэгдлээ',
      order
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
