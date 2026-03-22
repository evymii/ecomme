'use client';

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import Image from 'next/image';
import { getImageUrl } from '@/lib/image-utils';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { cn } from '@/lib/utils';

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
  sizes?: string[];
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
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>;
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const fieldClass =
  'h-[34px] w-full rounded-[7px] border border-[#e8e8e8] bg-[#fafafa] px-2.5 text-[12px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:ring-1 focus:ring-[#ccc]';

const labelClass = 'mb-[3px] block text-[10px] text-[#999]';

export default function ProductModal({
  open,
  onOpenChange,
  product,
  onSuccess,
  returnFocusRef,
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
  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeInput, setSizeInput] = useState('');
  const [images, setImages] = useState<ProductImage[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([]);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    const root = document.getElementById('__next');
    if (!open || !root) return;
    root.setAttribute('inert', '');
    return () => {
      root.removeAttribute('inert');
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) panelRef.current?.querySelector('button')?.focus();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (wasOpen.current && !open && returnFocusRef?.current) {
      returnFocusRef.current.focus();
    }
    wasOpen.current = open;
  }, [open, returnFocusRef]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/admin/categories');
        setCategories(response.data.categories || []);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast({
          title: 'Алдаа',
          description: 'Ангиллууд ачаалахад алдаа гарлаа',
          variant: 'destructive',
        });
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
      setSizes(product.sizes || []);
      setImages(product.images || []);
      const mainIdx = product.images.findIndex((img) => img.isMain);
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
      setSizes([]);
      setImages([]);
      setMainImageIndex(0);
    }
    setSizeInput('');
    setUploadProgress('');
  }, [product, open, toast]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    setImages((prevImages) => {
      const newImages: ProductImage[] = [];
      const remainingSlots = 10 - prevImages.length;

      Array.from(files)
        .slice(0, remainingSlots)
        .forEach((file) => {
          if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file);
            newImages.push({
              url,
              isMain: false,
              order: prevImages.length + newImages.length,
              file,
            });
          }
        });

      return [...prevImages, ...newImages];
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (mainImageIndex >= newImages.length) {
      setMainImageIndex(Math.max(0, newImages.length - 1));
    } else if (index < mainImageIndex) {
      setMainImageIndex((m) => m - 1);
    }
  };

  const setMainImage = (index: number) => {
    setMainImageIndex(index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.code ||
      !formData.name ||
      !formData.description ||
      !formData.price ||
      !formData.category ||
      !formData.stock
    ) {
      toast({
        title: 'Алдаа',
        description: 'Бүх шаардлагатай талбарыг бөглөнө үү',
        variant: 'destructive',
      });
      return;
    }

    if (images.length === 0) {
      toast({
        title: 'Алдаа',
        description: 'Хамгийн багадаа 1 зураг оруулна уу',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const newFiles = images.filter((img) => img.file);
      const uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        for (let i = 0; i < newFiles.length; i++) {
          setUploadProgress(`Зураг upload (${i + 1}/${newFiles.length})...`);
          const url = await uploadToCloudinary(newFiles[i].file!);
          uploadedUrls.push(url);
        }
      }

      let uploadCursor = 0;
      const finalImages = images.map((img, i) => {
        let url = img.url;
        if (img.file) {
          url = uploadedUrls[uploadCursor++];
        }
        return {
          url,
          isMain: i === mainImageIndex,
          order: i,
        };
      });

      setUploadProgress('Хадгалж байна...');

      const payload = {
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: parseFloat(formData.price),
        category: formData.category.trim(),
        stock: parseInt(formData.stock, 10),
        features: formData.features,
        images: finalImages,
        sizes,
      };

      if (product) {
        await api.put(`/admin/products/${product._id}`, payload, { timeout: 15000 });
        toast({ title: 'Амжилттай', description: 'Бараа шинэчлэгдлээ' });
      } else {
        await api.post('/admin/products', payload, { timeout: 15000 });
        toast({ title: 'Амжилттай', description: 'Бараа нэмэгдлээ' });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || error.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-3.5"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[82vh] w-[calc(100%-28px)] max-w-lg flex-col overflow-hidden rounded-[12px] border border-[#e0e0e0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-[1] flex shrink-0 items-start justify-between gap-3 border-b border-[#f2f2f2] bg-white px-3.5 py-2.5">
          <div className="min-w-0">
            <h2 className="text-[14px] font-medium leading-tight text-[#111]">
              {product ? 'Бараа засах' : 'Шинэ бараа нэмэх'}
            </h2>
            <p className="mt-0.5 text-[10px] leading-snug text-[#999]">
              {product ? 'Барааны мэдээллийг засах' : 'Шинэ барааны мэдээллийг оруулна уу'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-[#e8e8e8] bg-white text-[#555] hover:bg-[#fafafa]"
            aria-label="Хаах"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-[7px] px-[13px] py-[11px]">
              <div className="grid grid-cols-2 gap-[7px]">
                <div>
                  <label htmlFor="code" className={labelClass}>
                    Код *
                  </label>
                  <Input
                    id="code"
                    name="code"
                    autoComplete="off"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    required
                    className={fieldClass}
                    placeholder="001"
                  />
                </div>
                <div>
                  <label htmlFor="price" className={labelClass}>
                    Үнэ *
                  </label>
                  <Input
                    id="price"
                    name="price"
                    autoComplete="off"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    min="0"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="category" className={labelClass}>
                  Ангилал *
                </label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                  required
                >
                  <SelectTrigger
                    id="category"
                    className={cn(
                      fieldClass,
                      'h-[34px] [&>span]:text-[12px] [&>span]:text-[#111]'
                    )}
                  >
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                  <SelectContent className="border border-[#e8e8e8] bg-white text-[#111]">
                    {categories
                      .filter((cat) => cat.name)
                      .map((cat) => (
                        <SelectItem key={cat._id} value={cat.name} className="text-[12px]">
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="name" className={labelClass}>
                  Барааны нэр *
                </label>
                <Input
                  id="name"
                  name="productName"
                  autoComplete="off"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={fieldClass}
                  placeholder="Нэр"
                />
              </div>

              <div className="grid grid-cols-2 gap-[7px]">
                <div>
                  <label htmlFor="stock" className={labelClass}>
                    Нөөц *
                  </label>
                  <Input
                    id="stock"
                    name="stock"
                    autoComplete="off"
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    required
                    min="0"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="sizeInput" className={labelClass}>
                    Хэмжээ
                  </label>
                  <Input
                    id="sizeInput"
                    value={sizeInput}
                    onChange={(e) => setSizeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = sizeInput.trim();
                        if (val && !sizes.includes(val)) {
                          setSizes([...sizes, val]);
                          setSizeInput('');
                        }
                      }
                    }}
                    className={fieldClass}
                    placeholder="S, M, L"
                  />
                </div>
              </div>

              {sizes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sizes.map((size) => (
                    <span
                      key={size}
                      className="inline-flex items-center gap-1 rounded border border-[#e8e8e8] bg-[#fafafa] px-1.5 py-0.5 text-[11px] text-[#333]"
                    >
                      {size}
                      <button
                        type="button"
                        onClick={() => setSizes(sizes.filter((s) => s !== size))}
                        className="text-[#888] hover:text-[#111]"
                        aria-label="Хасах"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div>
                <label htmlFor="description" className={labelClass}>
                  Тайлбар *
                </label>
                <textarea
                  id="description"
                  name="description"
                  autoComplete="off"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className={cn(
                    fieldClass,
                    'h-[56px] resize-none py-2 leading-snug'
                  )}
                  placeholder="Тайлбар"
                />
              </div>
            </div>

            <div className="border-t border-[#f2f2f2] px-[13px] pb-2 pt-1">
              <p className="mb-2 text-[9px] uppercase tracking-[0.6px] text-[#c0c0c0]">
                Зураг {!product && '*'} (10 хүртэл)
              </p>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="flex cursor-pointer items-center gap-3 rounded-[9px] border-[1.5px] border-dashed border-[#e0e0e0] px-3 py-2.5"
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                >
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#f5f5f5] text-[#555]">
                    <IconUpload className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] leading-snug text-[#bbb]">
                    Файл сонгох эсвэл энд чирж тавих
                  </span>
                </label>
              </div>

              {images.length > 0 && (
                <div className="mt-3">
                  <div className="grid grid-cols-4 gap-1.5">
                    {images.map((img, index) => (
                      <div key={index} className="group relative aspect-square">
                        <div
                          className={cn(
                            'relative h-full w-full overflow-hidden rounded-md border bg-[#f5f5f5]',
                            index === mainImageIndex
                              ? 'border-[1.5px] border-[#111]'
                              : 'border border-[#ebebeb]'
                          )}
                        >
                          <Image
                            src={img.file ? img.url : getImageUrl(img.url)}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          {index === mainImageIndex && (
                            <span className="absolute left-0.5 top-0.5 rounded bg-[#111] px-1 py-px text-[8px] text-white">
                              Гол
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded bg-white/90 text-[10px] text-[#666] shadow-sm"
                            aria-label="Устгах"
                          >
                            ×
                          </button>
                          <button
                            type="button"
                            onClick={() => setMainImage(index)}
                            className="absolute bottom-0.5 left-0.5 right-0.5 rounded bg-[#111]/90 py-0.5 text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            Гол болгох
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-[#c0c0c0]">
                    Зургууд: {images.length}/10 · Гол зураг: {mainImageIndex + 1}-р зураг
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[#f2f2f2] px-[13px] py-3">
              <p className="mb-2 text-[9px] uppercase tracking-[0.6px] text-[#c0c0c0]">
                Онцлог
              </p>
              <div className="flex flex-col">
                <label className="flex cursor-pointer items-center gap-2 border-b border-[#f5f5f5] py-1.5">
                  <input
                    type="checkbox"
                    checked={formData.features.isNew}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        features: { ...formData.features, isNew: e.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-[#111]"
                  />
                  <span className="text-[12px] text-[#333]">Шинэ бараа</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 border-b border-[#f5f5f5] py-1.5">
                  <input
                    type="checkbox"
                    checked={formData.features.isFeatured}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        features: { ...formData.features, isFeatured: e.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-[#111]"
                  />
                  <span className="text-[12px] text-[#333]">Онцлох бараа</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={formData.features.isDiscounted}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        features: { ...formData.features, isDiscounted: e.target.checked },
                      })
                    }
                    className="h-3.5 w-3.5 accent-[#111]"
                  />
                  <span className="text-[12px] text-[#333]">Хямдарсан бараа</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex shrink-0 gap-2 border-t border-[#f2f2f2] bg-white px-[13px] pb-[14px] pt-[9px]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-[38px] flex-1 rounded-[9px] border border-[#e0e0e0] bg-white text-[13px] text-[#111] hover:bg-[#fafafa]"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-[38px] flex-1 rounded-[9px] bg-[#111] text-[13px] text-white hover:bg-[#333] disabled:opacity-60"
            >
              {loading ? uploadProgress || 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
