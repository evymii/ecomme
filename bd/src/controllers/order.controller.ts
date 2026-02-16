import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.js';
import Order from '../models/Order.model.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';

export const createOrder = async (req: Request | AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, deliveryAddress, paymentMethod, phoneNumber, email, customerName } = req.body;
    
    // Check if user is authenticated (optional for guest checkout)
    let user = null;
    if ('userId' in req && req.userId) {
      user = await User.findById(req.userId).session(session);
      if (!user) {
        await session.abortTransaction();
        session.endSession();
        res.status(404).json({ success: false, message: 'Хэрэглэгч олдсонгүй' });
        return;
      }
    }
    
    // For guest orders, validate phone number is provided and not empty
    const cleanPhoneNumber = phoneNumber ? phoneNumber.trim() : '';
    if (!user && (!phoneNumber || !cleanPhoneNumber)) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ success: false, message: 'Утасны дугаар оруулна уу' });
      return;
    }

    if (!items || items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ success: false, message: 'Сагс хоосон байна' });
      return;
    }

    if (!deliveryAddress || !deliveryAddress.address) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({ success: false, message: 'Хүргэлтийн хаяг оруулна уу' });
      return;
    }

    let total = 0;
    const orderItems = [];
    const productsToUpdate: Array<{ product: any; newStock: number }> = [];

    // Optimize: Fetch all products at once instead of one by one
    const productIds = items.map((item: { productId: string; quantity: number; size?: string }) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .session(session); // Don't use lean() - we need full documents to save
    
    // Create a map for quick lookup
    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    
    // Validate all products and calculate total (within transaction)
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        res.status(404).json({ success: false, message: `Бараа олдсонгүй: ${item.productId}` });
        return;
      }

      // Check stock with lock (within transaction)
      if (product.stock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({ success: false, message: `${product.name} барааны нөөц хүрэлцэхгүй байна` });
        return;
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.price,
        size: item.size
      });

      // Store product and new stock for batch update
      productsToUpdate.push({
        product,
        newStock: product.stock - item.quantity
      });
    }

    // Generate short order code (6-8 digits)
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderCode = (timestamp.slice(-5) + random).slice(-8); // Last 8 digits

    // Create order within transaction (user is optional for guest checkout)
    const order = new Order({
      ...(user && { user: user._id }), // Only include user if authenticated
      ...(!user && cleanPhoneNumber && { phoneNumber: cleanPhoneNumber }), // Store phone for guest orders
      ...(!user && email && { email: email.trim() }), // Store email for guest orders
      ...(!user && customerName && { customerName: customerName.trim() }), // Store name for guest orders
      items: orderItems,
      total,
      deliveryAddress,
      paymentMethod: paymentMethod || 'pay_later',
      orderCode,
      status: 'pending'
    });

    const savedOrder = await order.save({ session });

    // Update all product stocks within transaction
    for (const { product, newStock } of productsToUpdate) {
      product.stock = newStock;
      await product.save({ session });
    }

    // Commit transaction - all or nothing
    await session.commitTransaction();
    session.endSession();
    
    console.log('✅ Order saved successfully to database (transaction committed):', {
      orderId: savedOrder._id.toString(),
      orderCode: savedOrder.orderCode,
      userId: savedOrder.user ? savedOrder.user.toString() : 'guest',
      total: savedOrder.total,
      itemCount: savedOrder.items.length,
      status: savedOrder.status,
      createdAt: savedOrder.createdAt
    });
    
    // Return order immediately without populate to avoid timeout
    // Populate can be done later when viewing order details
    // This makes the response much faster
    const orderResponse = {
      _id: savedOrder._id,
      orderCode: savedOrder.orderCode,
      items: savedOrder.items.map((item: any) => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        size: item.size
      })),
      total: savedOrder.total,
      status: savedOrder.status,
      deliveryAddress: savedOrder.deliveryAddress,
      paymentMethod: savedOrder.paymentMethod,
      phoneNumber: savedOrder.phoneNumber,
      email: savedOrder.email,
      customerName: savedOrder.customerName,
      user: savedOrder.user || null,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt
    };

    res.status(201).json({
      success: true,
      message: 'Захиалга амжилттай үүслээ',
      order: orderResponse
    });
  } catch (error: any) {
    // Rollback transaction on error
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (rollbackError) {
      console.error('Error during transaction rollback:', rollbackError);
    }
    
    console.error('❌ Create order error (transaction rolled back):', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Захиалга үүсгэхэд алдаа гарлаа' 
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.product')
      .populate('user', 'name phoneNumber email');

    if (!order) {
      res.status(404).json({ success: false, message: 'Захиалга олдсонгүй' });
      return;
    }

    // Check if user owns this order or is admin (only if order has a user)
    if (order.user && req.userRole !== 'admin' && order.user._id.toString() !== req.userId) {
      res.status(403).json({ success: false, message: 'Энэ захиалгыг харах эрхгүй байна' });
      return;
    }

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, message: 'Нэвтрэх шаардлагатай' });
      return;
    }

    // Get the user's phone number to also match guest orders placed with the same phone
    const user = await User.findById(req.userId).select('phoneNumber').lean();
    const phoneNumber = user?.phoneNumber;

    // Build query: match by user ID OR by phone number
    const query: any[] = [{ user: req.userId }];
    if (phoneNumber) {
      query.push({ phoneNumber: phoneNumber, user: { $exists: false } });
      query.push({ phoneNumber: phoneNumber, user: null });
    }

    const orders = await Order.find({ $or: query })
      .populate('items.product')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
