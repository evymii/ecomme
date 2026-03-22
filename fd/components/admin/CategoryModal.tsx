'use client';

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
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
import { cn } from '@/lib/utils';

interface Category {
  _id: string;
  name: string;
  fullName?: string;
  shortName?: string;
  nameEn?: string;
  description?: string;
  isActive: boolean;
  parentId?: string | null;
  parentName?: string | null;
  level?: number;
  sortOrder?: number;
}

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSuccess: () => void;
  returnFocusRef?: React.MutableRefObject<HTMLElement | null>;
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SELECT_CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23666' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")";

const fieldClass =
  'h-[34px] w-full rounded-[7px] border border-[#e8e8e8] bg-[#fafafa] px-[9px] text-[12px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:ring-1 focus:ring-[#ccc]';

const labelClass = 'mb-[3px] block text-[10px] text-[#999]';

export default function CategoryModal({
  open,
  onOpenChange,
  category,
  onSuccess,
  returnFocusRef,
}: CategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    isActive: true,
    parentId: 'none',
    sortOrder: '0',
  });
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
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
    if (!open) return;
    const fetchCategories = async () => {
      try {
        const response = await api.get('/admin/categories');
        setAllCategories(response.data?.categories || []);
      } catch (_error) {
        setAllCategories([]);
      }
    };
    fetchCategories();
  }, [open]);

  useEffect(() => {
    if (category) {
      const shortName =
        category.shortName || category.name.split('/').pop() || category.name;
      setFormData({
        name: shortName,
        nameEn: category.nameEn || '',
        isActive: category.isActive,
        parentId: category.parentId || 'none',
        sortOrder: String(category.sortOrder ?? 0),
      });
    } else {
      setFormData({
        name: '',
        nameEn: '',
        isActive: true,
        parentId: 'none',
        sortOrder: '0',
      });
    }
  }, [category, open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const parentOptions = allCategories.filter((item) => {
    const isMain = !item.parentId;
    if (!isMain) return false;
    if (category && item._id === category._id) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: 'Алдаа',
        description: 'Ангиллын нэр оруулна уу',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        isActive: formData.isActive,
        parentId: formData.parentId === 'none' ? null : formData.parentId,
        sortOrder: formData.sortOrder === '' ? 0 : Number(formData.sortOrder),
      };

      if (category) {
        await api.put(`/admin/categories/${category._id}`, body);
        toast({ title: 'Амжилттай', description: 'Ангилал шинэчлэгдлээ' });
      } else {
        await api.post('/admin/categories', body);
        toast({ title: 'Амжилттай', description: 'Ангилал нэмэгдлээ' });
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

  if (!mounted || !open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/[0.38] p-3.5"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-[calc(100%-28px)] max-w-md flex-col overflow-hidden rounded-[12px] border border-[#e0e0e0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#f2f2f2] bg-white px-3.5 py-[11px]">
          <div className="min-w-0">
            <h2 className="text-[14px] font-medium leading-tight text-[#111]">
              {category ? 'Ангилал засах' : 'Шинэ ангилал нэмэх'}
            </h2>
            <p className="mt-0.5 text-[10px] leading-snug text-[#bbb]">
              {category ? 'Ангиллын мэдээллийг засах' : 'Шинэ ангиллын мэдээллийг оруулна уу'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-[#e8e8e8] bg-[#f7f7f7] text-[#555] hover:bg-[#efefef]"
            aria-label="Хаах"
          >
            <IconClose className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="scrollbar-hide flex-1 overflow-y-auto px-[14px] py-3">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="cat-name" className={labelClass}>
                    Монгол нэр *
                  </label>
                  <Input
                    id="cat-name"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className={fieldClass}
                    placeholder="Нэр"
                  />
                </div>
                <div>
                  <label htmlFor="cat-nameEn" className={labelClass}>
                    Англи нэр
                  </label>
                  <Input
                    id="cat-nameEn"
                    name="nameEn"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className={fieldClass}
                    placeholder="English"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="parent" className={labelClass}>
                  Эх ангилал
                </label>
                <Select
                  value={formData.parentId}
                  onValueChange={(value) => setFormData({ ...formData, parentId: value })}
                >
                  <SelectTrigger
                    id="parent"
                    className={cn(
                      fieldClass,
                      'flex h-[34px] appearance-none pr-9 [&>span]:text-[12px] [&>span]:text-[#111] [&>svg]:hidden'
                    )}
                    style={{
                      backgroundColor: '#fafafa',
                      backgroundImage: SELECT_CHEVRON,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 9px center',
                      backgroundSize: '10px 10px',
                    }}
                  >
                    <SelectValue placeholder="Сонгох" />
                  </SelectTrigger>
                  <SelectContent className="border border-[#e8e8e8] bg-white">
                    <SelectItem value="none" className="text-[12px]">
                      — Эх ангилал байхгүй —
                    </SelectItem>
                    {parentOptions.map((parent) => (
                      <SelectItem key={parent._id} value={parent._id} className="text-[12px]">
                        {parent.shortName || parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="sortOrder" className={labelClass}>
                  Дэс дугаар
                </label>
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  className={fieldClass}
                  min={0}
                />
              </div>

              <div className="flex items-center justify-between rounded-full border border-[#efefef] px-3 py-2">
                <span className="text-[12px] text-[#333]">Идэвхтэй</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.isActive}
                  onClick={() =>
                    setFormData({ ...formData, isActive: !formData.isActive })
                  }
                  className={cn(
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    formData.isActive ? 'bg-[#111]' : 'bg-[#e0e0e0]'
                  )}
                >
                  <span
                    className={cn(
                      'absolute left-0.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-200',
                      formData.isActive ? 'translate-x-[22px]' : 'translate-x-0'
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-[7px] border-t border-[#f2f2f2] bg-white px-[14px] pb-3 pt-[9px]">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-9 flex-1 rounded-lg border border-[#e0e0e0] bg-white text-[12px] text-[#555] hover:bg-[#fafafa]"
            >
              Цуцлах
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-9 flex-1 rounded-lg border-0 bg-[#111] text-[12px] font-medium text-white hover:bg-[#333] disabled:opacity-60"
            >
              {loading ? 'Хадгалж байна...' : 'Хадгалах'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
