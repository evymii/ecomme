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

    // Validate all products and calculate total (within transaction)
    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
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
    
    // Populate the order before sending response (outside transaction)
    const populatedOrder = await Order.findById(savedOrder._id)
      .populate('user', 'name phoneNumber email')
      .populate('items.product');

    if (!populatedOrder) {
      console.error('❌ Failed to populate order after save');
      res.status(500).json({ success: false, message: 'Захиалга үүсгэхэд алдаа гарлаа' });
      return;
    }

    console.log('✅ Order populated and ready to send:', {
      orderId: populatedOrder._id.toString(),
      user: populatedOrder.user,
      itemsCount: populatedOrder.items.length
    });

    res.status(201).json({
      success: true,
      message: 'Захиалга амжилттай үүслээ',
      order: populatedOrder
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

    const orders = await Order.find({ user: req.userId })
      .populate('items.product')
      .sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
