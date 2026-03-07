import { Request, Response } from 'express';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';

type HomePayload = {
  featuredProducts: any[];
  discountedProducts: any[];
  allProducts: any[];
  allProductsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  categories: any[];
};

let cachedHomePayload: HomePayload | null = null;
let cachedHomeExpiresAt = 0;

const HOME_CACHE_TTL_MS = 60 * 1000;

export const getHomeData = async (_req: Request, res: Response): Promise<void> => {
  try {
    if (cachedHomePayload && cachedHomeExpiresAt > Date.now()) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json({
        success: true,
        ...cachedHomePayload,
      });
      return;
    }

    const [featuredProducts, discountedProducts, allProducts, totalAllProducts, categories] = await Promise.all([
      Product.find({
        $or: [{ 'features.isNew': true }, { 'features.isFeatured': true }],
      })
        .select('name price images features stock category createdAt code')
        .slice('images', 1)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .maxTimeMS(5000),
      Product.find({ 'features.isDiscounted': true })
        .select('name price images features stock category createdAt code')
        .slice('images', 1)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .maxTimeMS(5000),
      Product.find()
        .select('name price images features stock category createdAt code')
        .slice('images', 1)
        .sort({ createdAt: -1 })
        .limit(12)
        .lean()
        .maxTimeMS(5000),
      Product.countDocuments(),
      Category.find({ isActive: true })
        .select('name')
        .sort({ name: 1 })
        .lean()
        .maxTimeMS(4000),
    ]);
    const allProductsTotalPages = Math.max(1, Math.ceil(totalAllProducts / 12));

    const payload: HomePayload = {
      featuredProducts,
      discountedProducts,
      allProducts,
      allProductsPagination: {
        page: 1,
        limit: 12,
        total: totalAllProducts,
        totalPages: allProductsTotalPages,
        hasMore: allProductsTotalPages > 1,
      },
      categories,
    };

    cachedHomePayload = payload;
    cachedHomeExpiresAt = Date.now() + HOME_CACHE_TTL_MS;

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json({
      success: true,
      ...payload,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
