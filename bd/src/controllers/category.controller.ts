import { Request, Response } from 'express';
import Category from '../models/Category.model.js';

type CacheEntry = {
  expiresAt: number;
  data: any;
};

const CACHE_TTL_MS = 60 * 1000;
const categoryCache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const hit = categoryCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    categoryCache.delete(key);
    return null;
  }
  return hit.data as T;
}

function setCached(key: string, data: any, ttlMs = CACHE_TTL_MS) {
  categoryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function clearCategoryCache() {
  categoryCache.clear();
}

export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'categories:active';
    const cachedCategories = getCached<any[]>(cacheKey);

    if (cachedCategories) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json({ success: true, categories: cachedCategories });
      return;
    }

    const categories = await Category.find({ isActive: true })
      .select('name nameEn description isActive createdAt')
      .sort({ name: 1 })
      .lean()
      .maxTimeMS(4000);

    setCached(cacheKey, categories);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, nameEn, description, isActive } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Ангиллын нэр оруулна уу' });
      return;
    }

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      res.status(400).json({ success: false, message: 'Энэ ангилал аль хэдийн байна' });
      return;
    }

    const category = new Category({
      name: name.trim(),
      nameEn: nameEn?.trim(),
      description: description?.trim(),
      isActive: isActive !== undefined ? isActive : true
    });

    await category.save();
    clearCategoryCache();

    res.status(201).json({
      success: true,
      message: 'Ангилал амжилттай нэмэгдлээ',
      category
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Энэ нэртэй ангилал аль хэдийн байна' });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, nameEn, description, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: 'Ангилал олдсонгүй' });
      return;
    }

    // Check if new name conflicts with existing category
    if (name && name !== category.name) {
      const existingCategory = await Category.findOne({ name });
      if (existingCategory) {
        res.status(400).json({ success: false, message: 'Энэ нэртэй ангилал аль хэдийн байна' });
        return;
      }
    }

    if (name) category.name = name.trim();
    if (nameEn !== undefined) category.nameEn = nameEn?.trim();
    if (description !== undefined) category.description = description?.trim();
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    clearCategoryCache();

    res.json({
      success: true,
      message: 'Ангилал амжилттай шинэчлэгдлээ',
      category
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ success: false, message: 'Энэ нэртэй ангилал аль хэдийн байна' });
      return;
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      res.status(404).json({ success: false, message: 'Ангилал олдсонгүй' });
      return;
    }

    clearCategoryCache();
    res.json({ success: true, message: 'Ангилал амжилттай устгалаа' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
