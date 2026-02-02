import { Request, Response } from 'express';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Бараа олдсонгүй' });
      return;
    }
    res.json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category } = req.params;
    
    // Decode URL-encoded category parameter
    const decodedCategory = decodeURIComponent(category);
    
    // Check if category is an ObjectId (category ID) or a string (category name)
    let categoryName: string;
    
    // Check if it's a valid MongoDB ObjectId format (24 hex characters)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(decodedCategory);
    
    if (isValidObjectId) {
      // Try to find category by ID first
      try {
        const categoryDoc = await Category.findById(decodedCategory);
        if (categoryDoc) {
          categoryName = categoryDoc.name;
        } else {
          // If not found by ID, assume it's a category name
          categoryName = decodedCategory;
        }
      } catch (error) {
        // If findById fails, assume it's a category name
        categoryName = decodedCategory;
      }
    } else {
      // Not a valid ObjectId, assume it's a category name
      categoryName = decodedCategory;
    }
    
    const products = await Product.find({ category: categoryName }).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (error: any) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeaturedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({
      $or: [
        { 'features.isNew': true },
        { 'features.isFeatured': true }
      ]
    }).sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDiscountedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ 'features.isDiscounted': true })
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
