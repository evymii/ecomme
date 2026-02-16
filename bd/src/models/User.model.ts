import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phoneNumber: string;
  email: string;
  name: string;
  password: string; // Hashed password or 'clerk-managed'
  role: 'admin' | 'user';
  isEmailVerified?: boolean; // Email verification status
  emailVerificationToken?: string; // Token for email verification
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
      required: true,
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
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String
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

// Index for faster queries
UserSchema.index({ phoneNumber: 1 });
UserSchema.index({ email: 1 });

export default mongoose.model<IUser>('User', UserSchema);
