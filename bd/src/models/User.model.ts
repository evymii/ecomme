import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phoneNumber: string;
  email?: string;
  name: string;
  password: string;
  role: 'admin' | 'user';
  address?: {
    city: string;
    district: string;
    khoroo: string;
    deliveryAddress: string;
    additionalInfo?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user'
    },
    address: {
      city: { type: String },
      district: { type: String },
      khoroo: { type: String },
      deliveryAddress: { type: String },
      additionalInfo: { type: String }
    }
  },
  {
    timestamps: true
  }
);

// Phone is the local-auth login identifier; email is optional legacy/contact data.
UserSchema.index({ phoneNumber: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { sparse: true });

export default mongoose.model<IUser>('User', UserSchema);
