import { Request, Response } from 'express';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Optimize: use lean() for faster queries and select only needed fields
    const products = await Product.find()
      .select('name price images features stock category createdAt code')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .limit(100) // Limit results for better performance
      .lean();
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    // Use lean() for faster query
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      res.status(404).json({ success: false, message: 'Бараа олдсонгүй' });
      return;
    }
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
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
        const categoryDoc = await Category.findById(decodedCategory).lean();
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
    
    // Optimize: use lean() and select only needed fields
    const products = await Product.find({ category: categoryName })
      .select('name price images features stock category createdAt code')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .limit(100) // Limit results
      .lean();
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({ success: true, products });
  } catch (error: any) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeaturedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Optimize: use lean() and select only needed fields
    const products = await Product.find({
      $or: [
        { 'features.isNew': true },
        { 'features.isFeatured': true }
      ]
    })
      .select('name price images features stock category createdAt code')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDiscountedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    // Optimize: use lean() and select only needed fields
    const products = await Product.find({ 'features.isDiscounted': true })
      .select('name price images features stock category createdAt code')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Escape special regex characters to prevent MongoDB regex errors
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Search products by name (Mongolian/English) or product code
export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length < 1) {
      res.json({ success: true, products: [] });
      return;
    }
    
    const searchQuery = q.trim();
    const escapedQuery = escapeRegex(searchQuery);
    
    // Search by name (supports Mongolian and English) or product code
    // Using regex for partial matching, case-insensitive
    const products = await Product.find({
      $or: [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { code: { $regex: escapedQuery, $options: 'i' } }
      ]
    })
      .select('name price images features stock category createdAt code')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    res.json({ success: true, products });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
