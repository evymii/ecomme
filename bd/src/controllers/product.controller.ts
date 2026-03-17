import { Request, Response } from 'express';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';

type CacheEntry = {
  expiresAt: number;
  data: any;
};

const CACHE_TTL_MS = 45 * 1000;
const productCache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const hit = productCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    productCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCached(key: string, data: any, ttlMs = CACHE_TTL_MS) {
  productCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function getPagination(req: Request) {
  const pageRaw = Number.parseInt(String(req.query.page || '1'), 10);
  const limitRaw = Number.parseInt(String(req.query.limit || '12'), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 12;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPagination(req);
    const cacheKey = `products:all:${page}:${limit}`;
    const cachedPayload = getCached<any>(cacheKey);
    if (cachedPayload) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedPayload);
      return;
    }

    // Optimize: paginated + lean + projected fields
    const [products, total] = await Promise.all([
      Product.find()
        .select('name price images features stock category createdAt code')
        .slice('images', 1)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(5000),
      Product.countDocuments(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const payload = {
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
    
    // Set cache headers
    setCached(cacheKey, payload);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
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
    const { page, limit, skip } = getPagination(req);
    
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
    
    const normalizedCategory = categoryName.trim();
    const isSubcategoryQuery = normalizedCategory.includes('/');
    const categoryQuery = isSubcategoryQuery
      ? {
          // Subcategory selected: exact category only.
          category: { $regex: new RegExp(`^${escapeRegex(normalizedCategory)}$`, 'i') },
        }
      : {
          // Main category selected: include main + all nested subcategories.
          category: { $regex: new RegExp(`^${escapeRegex(normalizedCategory)}(?:\\/.*)?$`, 'i') },
        };

    const cacheKey = `products:category:${normalizedCategory}:${page}:${limit}`;
    const cachedPayload = getCached<any>(cacheKey);
    if (cachedPayload) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json(cachedPayload);
      return;
    }

    // Optimize: paginated + lean + projected fields
    const [products, total] = await Promise.all([
      Product.find(categoryQuery)
        .select('name price images features stock category createdAt code')
        .slice('images', 1)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(5000),
      Product.countDocuments(categoryQuery),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const payload = {
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
    
    // Set cache headers
    setCached(cacheKey, payload);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (error: any) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeaturedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'products:featured';
    const cachedProducts = getCached<any[]>(cacheKey);
    if (cachedProducts) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json({ success: true, products: cachedProducts });
      return;
    }

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
      .lean()
      .maxTimeMS(5000);
    
    // Set cache headers
    setCached(cacheKey, products);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDiscountedProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'products:discounted';
    const cachedProducts = getCached<any[]>(cacheKey);
    if (cachedProducts) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json({ success: true, products: cachedProducts });
      return;
    }

    // Optimize: use lean() and select only needed fields
    const products = await Product.find({ 'features.isDiscounted': true })
      .select('name price images features stock category createdAt code')
      .slice('images', 1)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()
      .maxTimeMS(5000);
    
    // Set cache headers
    setCached(cacheKey, products);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
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
    const cacheKey = `products:search:${escapedQuery.toLowerCase()}`;
    const cachedProducts = getCached<any[]>(cacheKey);
    if (cachedProducts) {
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=30');
      res.setHeader('X-Cache', 'HIT');
      res.json({ success: true, products: cachedProducts });
      return;
    }
    
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
      .lean()
      .maxTimeMS(5000);

    setCached(cacheKey, products, 30 * 1000);
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=30');
    res.setHeader('X-Cache', 'MISS');
    res.json({ success: true, products });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
