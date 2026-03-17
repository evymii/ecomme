import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  nameEn?: string; // Optional English name
  description?: string;
  isActive: boolean;
  parent?: mongoose.Types.ObjectId | null;
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
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
// Note: name already has unique: true in field definition, so no need to index it again
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ parent: 1, isActive: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema);
