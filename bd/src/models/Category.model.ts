import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  nameEn?: string; // Optional English name
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    nameEn: {
      type: String,
      trim: true
    },
    description: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
// Note: name already has unique: true in field definition, so no need to index it again
CategorySchema.index({ isActive: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema);
