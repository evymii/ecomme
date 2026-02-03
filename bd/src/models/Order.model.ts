import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  size?: string;
}

export interface IOrder extends Document {
  user?: mongoose.Types.ObjectId; // Optional for guest checkout
  phoneNumber?: string; // Phone number for guest orders
  email?: string; // Email for guest orders
  customerName?: string; // Customer name for guest orders
  items: IOrderItem[];
  total: number;
  deliveryAddress: {
    address: string;
    additionalInfo?: string;
  };
  paymentMethod: 'pay_later' | 'paid_personally' | 'bank_transfer';
  orderCode?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  size: { type: String }
});

const OrderSchema = new Schema<IOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false // Allow guest checkout
    },
    phoneNumber: {
      type: String,
      required: false // For guest orders
    },
    email: {
      type: String,
      required: false // For guest orders
    },
    customerName: {
      type: String,
      required: false // For guest orders
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: function(items: IOrderItem[]) {
          return items.length > 0;
        },
        message: 'Order must have at least one item'
      }
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    deliveryAddress: {
      address: { type: String, required: true },
      additionalInfo: { type: String }
    },
    paymentMethod: {
      type: String,
      enum: ['pay_later', 'paid_personally', 'bank_transfer'],
      default: 'pay_later'
    },
    orderCode: {
      type: String,
      unique: true,
      sparse: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
// Note: orderCode already has unique: true in field definition, so no need to index it again
OrderSchema.index({ createdAt: -1 }); // For sorting by date
OrderSchema.index({ user: 1, createdAt: -1 }); // For user's orders
OrderSchema.index({ status: 1, createdAt: -1 }); // For filtering by status
OrderSchema.index({ orderCode: 1 }); // For finding by order code

export default mongoose.model<IOrder>('Order', OrderSchema);
