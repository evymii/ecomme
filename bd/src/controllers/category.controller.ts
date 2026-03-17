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
    const isAdminRequest = req.baseUrl.includes('/admin');
    const cacheKey = isAdminRequest ? 'categories:admin:all' : 'categories:active';
    const cachedCategories = getCached<any[]>(cacheKey);

    if (cachedCategories) {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
      res.setHeader('X-Cache', 'HIT');
      res.json({ success: true, categories: cachedCategories });
      return;
    }

    const query = isAdminRequest ? {} : { isActive: true };
    const categories = await Category.find(query)
      .select('name nameEn description isActive createdAt parent')
      .populate('parent', 'name')
      .sort({ name: 1 })
      .lean()
      .maxTimeMS(4000);

    const normalizedCategories = categories.map((category: any) => {
      const fullName = category.name;
      const segments = String(fullName || '')
        .split('/')
        .map((segment: string) => segment.trim())
        .filter(Boolean);
      const shortName = segments.length > 0 ? segments[segments.length - 1] : fullName;
      const parentName = category.parent?.name || null;
      const level = parentName || segments.length > 1 ? 2 : 1;
      return {
        ...category,
        fullName,
        shortName,
        parentId: category.parent?._id || null,
        parentName,
        level,
      };
    });

    setCached(cacheKey, normalizedCategories);
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=60');
    res.setHeader('X-Cache', 'MISS');
    res.json({ success: true, categories: normalizedCategories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, nameEn, description, isActive, parentId } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Ангиллын нэр оруулна уу' });
      return;
    }

    const rawName = String(name).trim();
    if (!rawName) {
      res.status(400).json({ success: false, message: 'Ангиллын нэр оруулна уу' });
      return;
    }

    let parent: any = null;
    if (parentId) {
      parent = await Category.findById(parentId).select('name parent').lean();
      if (!parent) {
        res.status(400).json({ success: false, message: 'Эцэг ангилал олдсонгүй' });
        return;
      }
      if (parent.parent) {
        res.status(400).json({ success: false, message: 'Зөвхөн 2 түвшний ангилал дэмжинэ' });
        return;
      }
    }

    const childName = rawName.replace(/\//g, ' ').trim();
    const fullName = parent ? `${parent.name}/${childName}` : childName;

    // Check if category already exists
    const existingCategory = await Category.findOne({ name: fullName });
    if (existingCategory) {
      res.status(400).json({ success: false, message: 'Энэ ангилал аль хэдийн байна' });
      return;
    }

    const category = new Category({
      name: fullName,
      nameEn: nameEn?.trim(),
      description: description?.trim(),
      isActive: isActive !== undefined ? isActive : true,
      parent: parent ? parent._id : null,
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
    const { name, nameEn, description, isActive, parentId } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ success: false, message: 'Ангилал олдсонгүй' });
      return;
    }

    let parent: any = null;
    if (parentId) {
      if (String(parentId) === String(id)) {
        res.status(400).json({ success: false, message: 'Өөрийгөө parent болгож болохгүй' });
        return;
      }
      parent = await Category.findById(parentId).select('name parent').lean();
      if (!parent) {
        res.status(400).json({ success: false, message: 'Эцэг ангилал олдсонгүй' });
        return;
      }
      if (parent.parent) {
        res.status(400).json({ success: false, message: 'Зөвхөн 2 түвшний ангилал дэмжинэ' });
        return;
      }
    }

    const currentShortName = String(category.name || '')
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .pop() || category.name;
    const requestedShortName = name ? String(name).replace(/\//g, ' ').trim() : currentShortName;
    const requestedFullName = parent ? `${parent.name}/${requestedShortName}` : requestedShortName;

    // Check if new name conflicts with existing category
    if (requestedFullName !== category.name) {
      const existingCategory = await Category.findOne({ name: requestedFullName });
      if (existingCategory) {
        res.status(400).json({ success: false, message: 'Энэ нэртэй ангилал аль хэдийн байна' });
        return;
      }
    }

    category.name = requestedFullName;
    if (nameEn !== undefined) category.nameEn = nameEn?.trim();
    if (description !== undefined) category.description = description?.trim();
    if (isActive !== undefined) category.isActive = isActive;
    category.parent = parent ? parent._id : null;

    await category.save();

    // Keep child paths in sync when a main category is renamed.
    const childCategories = await Category.find({ parent: category._id }).select('_id name').lean();
    if (childCategories.length > 0) {
      const parentPrefix = category.name;
      await Promise.all(
        childCategories.map(async (child: any) => {
          const childShortName = String(child.name || '')
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean)
            .pop();
          if (!childShortName) return;
          await Category.findByIdAndUpdate(child._id, { name: `${parentPrefix}/${childShortName}` });
        })
      );
    }

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

    const hasChildren = await Category.exists({ parent: id });
    if (hasChildren) {
      res.status(400).json({
        success: false,
        message: 'Эхлээд дэд ангиллуудыг устгана уу',
      });
      return;
    }

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
