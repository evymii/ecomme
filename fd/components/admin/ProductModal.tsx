'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import Image from 'next/image';
import { Star, X, Upload } from 'lucide-react';
import { getImageUrl } from '@/lib/image-utils';

interface ProductImage {
  url: string;
  isMain: boolean;
  order?: number;
  file?: File;
}

interface Product {
  _id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  images: ProductImage[];
  features: {
    isNew: boolean;
    isFeatured: boolean;
    isDiscounted: boolean;
  };
}

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onSuccess: () => void;
}

export default function ProductModal({
  open,
  onOpenChange,
  product,
  onSuccess,
}: ProductModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    price: '0',
    category: '',
    stock: '0',
    features: {
      isNew: false,
      isFeatured: false,
      isDiscounted: false,
    },
  });
  const [images, setImages] = useState<ProductImage[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const response = await api.get('/admin/categories');
        setCategories(response.data.categories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();

    if (product) {
      setFormData({
        code: product.code,
        name: product.name,
        description: product.description,
        price: product.price.toString(),
        category: product.category,
        stock: product.stock.toString(),
        features: product.features,
      });
      setImages(product.images || []);
      const mainIdx = product.images.findIndex(img => img.isMain);
      setMainImageIndex(mainIdx >= 0 ? mainIdx : 0);
    } else {
      setFormData({
        code: '',
        name: '',
        description: '',
        price: '0',
        category: '',
        stock: '0',
        features: {
          isNew: false,
          isFeatured: false,
          isDiscounted: false,
        },
      });
      setImages([]);
      setMainImageIndex(0);
    }
  }, [product, open]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newImages: ProductImage[] = [];
    const remainingSlots = 10 - images.length;

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newImages.push({
          url,
          isMain: false,
          order: images.length + newImages.length,
          file,
        });
      }
    });

    setImages([...images, ...newImages]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [images]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (mainImageIndex >= newImages.length) {
      setMainImageIndex(Math.max(0, newImages.length - 1));
    }
  };

  const setMainImage = (index: number) => {
    setMainImageIndex(index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.code || !formData.name || !formData.description || !formData.price || !formData.category || !formData.stock) {
      toast({
        title: 'Алдаа',
        description: 'Бүх шаардлагатай талбарыг бөглөнө үү',
        variant: 'destructive',
      });
      return;
    }

    // For new products, require at least one image
    if (!product && images.length === 0) {
      toast({
        title: 'Алдаа',
        description: 'Хамгийн багадаа 1 зураг оруулна уу',
        variant: 'destructive',
      });
      return;
    }

    // For existing products, require at least one image (existing or new)
    if (product && images.length === 0) {
      toast({
        title: 'Алдаа',
        description: 'Хамгийн багадаа 1 зураг байх ёстой',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('code', formData.code.trim());
      formDataToSend.append('name', formData.name.trim());
      formDataToSend.append('description', formData.description.trim());
      formDataToSend.append('price', formData.price.toString());
      formDataToSend.append('category', formData.category.trim());
      formDataToSend.append('stock', formData.stock.toString());
      formDataToSend.append('mainImageIndex', mainImageIndex.toString());
      formDataToSend.append('features', JSON.stringify(formData.features));

      // Separate new files from existing images
      const filesToUpload = images.filter(img => img.file);
      const existingImages = images.filter(img => !img.file);

      // For updates: always send existing images data
      if (product) {
        formDataToSend.append('existingImages', JSON.stringify(
          existingImages.map((img, idx) => ({
            url: img.url,
            isMain: false, // Will be set correctly on backend based on mainImageIndex
            order: idx
          }))
        ));
      }

      // Append new files (if any)
      filesToUpload.forEach((img) => {
        if (img.file) {
          formDataToSend.append('images', img.file);
        }
      });

      // Don't set Content-Type header - let axios/browser set it automatically for FormData
      if (product) {
        await api.put(`/admin/products/${product._id}`, formDataToSend);
        toast({ title: 'Амжилттай', description: 'Бараа шинэчлэгдлээ' });
      } else {
        await api.post('/admin/products', formDataToSend);
        toast({ title: 'Амжилттай', description: 'Бараа нэмэгдлээ' });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Бараа засах' : 'Шинэ бараа нэмэх'}</DialogTitle>
          <DialogDescription>
            {product ? 'Барааны мэдээллийг засах' : 'Шинэ барааны мэдээллийг оруулна уу'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Барааны код *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                placeholder="001"
              />
            </div>

            <div>
              <Label htmlFor="category">Ангилал *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ангилал сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(cat => cat.name).map((cat) => (
                    <SelectItem key={cat._id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="name">Барааны нэр *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Барааны нэрийг оруулна уу"
              />
            </div>

            <div>
              <Label htmlFor="stock">Нөөц *</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                required
                min="0"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Тайлбар *</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Барааны дэлгэрэнгүй мэдээлэл"
              />
            </div>

            <div>
              <Label htmlFor="price">Үнэ *</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
                min="0"
              />
            </div>
          </div>

          <div>
            <Label>Зураг {!product && '*'} (Хамгийн ихдээ 10 зураг)</Label>
            {product && (
              <p className="text-xs text-gray-500 mb-2">
                Одоогийн зургуудыг хадгалах эсвэл шинэ зургууд нэмэх
              </p>
            )}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
            >
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files)}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Файл сонгох эсвэл энд чирж тавих
                </p>
              </label>
            </div>

            {images.length > 0 && (
              <div className="mt-4">
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <div className="relative aspect-square rounded overflow-hidden border-2 border-gray-200">
                        {img.url.startsWith('blob:') ? (
                          <img
                            src={img.url}
                            alt={`Image ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Image
                            src={getImageUrl(img.url)}
                            alt={`Image ${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        )}
                        {index === mainImageIndex && (
                          <div className="absolute top-1 right-1 bg-yellow-400 rounded-full p-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-600" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 left-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMainImage(index)}
                          className="absolute bottom-1 right-1 bg-blue-500 text-white rounded px-1 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Гол зураг
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Зургууд: {images.length}/10 | Гол зураг: {mainImageIndex + 1}-р зураг
                </p>
              </div>
            )}
          </div>

          <div>
            <Label>Онцлог</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.features.isNew}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      features: { ...formData.features, isNew: e.target.checked },
                    })
                  }
                  className="w-4 h-4"
                />
                <span>Шинэ бараа</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.features.isFeatured}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      features: { ...formData.features, isFeatured: e.target.checked },
                    })
                  }
                  className="w-4 h-4"
                />
                <span>Онцлох бараа</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.features.isDiscounted}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      features: { ...formData.features, isDiscounted: e.target.checked },
                    })
                  }
                  className="w-4 h-4"
                />
                <span>Хямдарсан бараа</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Цуцлах
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Хадгалж байна...' : 'Хадгалах'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
