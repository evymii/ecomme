import mongoose, { Schema, Document } from 'mongoose';

export interface IProductImage {
  url: string;
  isMain: boolean;
  order: number;
}

export interface IProduct extends Document {
  code: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  sizes?: string[]; // Optional sizes array
  images: IProductImage[];
  features: {
    isNew: boolean;
    isFeatured: boolean;
    isDiscounted: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>({
  url: { type: String, required: true },
  isMain: { type: Boolean, default: false },
  order: { type: Number, default: 0 }
});

const ProductSchema = new Schema<IProduct>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    sizes: {
      type: [String],
      default: []
    },
    images: {
      type: [ProductImageSchema],
      default: [],
      validate: {
        validator: function(images: IProductImage[]) {
          return images.length <= 10;
        },
        message: 'Maximum 10 images allowed'
      }
    },
    features: {
      isNew: { type: Boolean, default: false },
      isFeatured: { type: Boolean, default: false },
      isDiscounted: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
// Note: code already has unique: true in field definition, so no need to index it again
ProductSchema.index({ name: 1 }); // Index for search by name
ProductSchema.index({ category: 1 });
ProductSchema.index({ 'features.isFeatured': 1 });
ProductSchema.index({ 'features.isNew': 1 });
ProductSchema.index({ 'features.isDiscounted': 1 });
// Compound index for common queries (featured + createdAt)
ProductSchema.index({ 'features.isFeatured': 1, createdAt: -1 });
ProductSchema.index({ 'features.isDiscounted': 1, createdAt: -1 });
ProductSchema.index({ 'features.isNew': 1, createdAt: -1 });
ProductSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model<IProduct>('Product', ProductSchema);
