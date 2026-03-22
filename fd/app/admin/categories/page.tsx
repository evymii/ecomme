'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Header from '@/components/layout/Header';
import CategoryModal from '@/components/admin/CategoryModal';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { getCache, setCache, clearCache } from '@/lib/admin-cache';
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

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="white" strokeWidth="1.8" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="3 6 5 6 21 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="9 18 15 12 9 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function sortCategories(a: Category, b: Category) {
  const oa = a.sortOrder ?? 0;
  const ob = b.sortOrder ?? 0;
  if (oa !== ob) return oa - ob;
  const na = (a.shortName || a.name).trim();
  const nb = (b.shortName || b.name).trim();
  return na.localeCompare(nb, 'mn');
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const CACHE_KEY = 'admin_categories';

  const fetchCategories = useCallback(
    async (skipCache = false) => {
      if (!skipCache) {
        const cached = getCache<Category[]>(CACHE_KEY, 120_000);
        if (cached) {
          setCategories(cached);
          setLoading(false);
          api
            .get('/admin/categories')
            .then((res) => {
              if (res.data?.success) {
                setCategories(res.data.categories || []);
                setCache(CACHE_KEY, res.data.categories || []);
              }
            })
            .catch(() => {});
          return;
        }
      }

      try {
        const response = await api.get('/admin/categories');
        if (!response.data?.success) {
          toast({
            title: 'Алдаа',
            description: response.data?.message || 'Ангиллууд авахад алдаа гарлаа',
            variant: 'destructive',
          });
          return;
        }
        const data = response.data.categories || [];
        setCategories(data);
        setCache(CACHE_KEY, data);
      } catch (error: any) {
        console.error('Error fetching categories:', error);
        toast({
          title: 'Алдаа',
          description: error.response?.data?.message || 'Ангиллууд авахад алдаа гарлаа',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchCategories();
    }
  }, [isAdmin, isChecking, fetchCategories]);

  const rootCategories = useMemo(() => {
    return categories.filter((c) => !c.parentId).sort(sortCategories);
  }, [categories]);

  const childrenOf = useCallback(
    (parentId: string) =>
      categories
        .filter((c) => c.parentId && String(c.parentId) === String(parentId))
        .sort(sortCategories),
    [categories]
  );

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm('Энэ ангиллыг устгахдаа итгэлтэй байна уу?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      setCategories((prev) => prev.filter((category) => category._id !== id));
      toast({
        title: 'Амжилттай',
        description: `"${name}" ангилал устгагдлаа`,
      });
      clearCache(CACHE_KEY);
      void fetchCategories(true);
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  if (isChecking) {
    return <Loader />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="sticky top-0 z-10 border-b border-[#efefef] bg-white px-[14px] pb-[11px] pt-[13px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[16px] font-medium leading-tight text-[#111]">
              Ангиллын удирдлага
            </h1>
            <p className="mt-0.5 text-[11px] leading-snug text-[#888]">
              Бүх ангиллыг удирдах
            </p>
          </div>
          {!loading && (
            <span className="shrink-0 rounded-[20px] border border-[#e8e8e8] bg-[#f5f5f5] px-[9px] py-0.5 text-[11px] leading-none text-[#111]">
              {categories.length} ангилал
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingCategory(null);
            setModalOpen(true);
          }}
          className="mt-[9px] flex h-[34px] w-full items-center justify-center gap-2 rounded-lg border-0 bg-[#111] text-[12px] font-medium text-white shadow-none outline-none ring-0 hover:bg-[#111] active:bg-[#222]"
        >
          <IconPlus className="h-3.5 w-3.5 shrink-0 text-white" />
          Ангилал нэмэх
        </button>
      </div>

      <main className="bg-white px-[10px] py-2.5">
        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : categories.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-[#888]">Ангилал олдсонгүй</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rootCategories.map((parent) => {
              const displayName = parent.shortName || parent.name;
              const children = childrenOf(parent._id);
              const hasChildren = children.length > 0;
              const expanded = expandedIds.has(parent._id);

              return (
                <li key={parent._id} className="list-none">
                  <div
                    role={hasChildren ? 'button' : undefined}
                    tabIndex={hasChildren ? 0 : undefined}
                    onClick={
                      hasChildren
                        ? () => toggleExpand(parent._id)
                        : undefined
                    }
                    onKeyDown={
                      hasChildren
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleExpand(parent._id);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'flex items-center gap-[10px] rounded-[10px] border border-[#ddd] bg-white px-3 py-[10px]',
                      hasChildren && 'cursor-pointer'
                    )}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111]">
                      <IconGrid className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate whitespace-nowrap text-[13px] font-medium leading-tight text-[#111]">
                        {displayName}
                      </p>
                      {parent.nameEn ? (
                        <p className="truncate whitespace-nowrap text-[10px] leading-tight text-[#bbb]">
                          {parent.nameEn}
                        </p>
                      ) : null}
                    </div>
                    {hasChildren ? (
                      <span className="shrink-0 whitespace-nowrap rounded-[10px] border border-[#ebebeb] bg-[#f5f5f5] px-[7px] py-px text-[10px] leading-none text-[#111]">
                        {children.length} дэд
                      </span>
                    ) : null}
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(parent);
                        }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#e8e8e8] bg-[#fafafa] text-[#444]"
                        aria-label="Засах"
                      >
                        <IconEdit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(parent._id, displayName);
                        }}
                        className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#e8e8e8] bg-[#fafafa] text-[#666]"
                        aria-label="Устгах"
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {hasChildren ? (
                      <IconChevron
                        className={cn(
                          'h-3 w-3 shrink-0 text-[#bbb] transition-transform duration-200',
                          /* polyline points up; collapsed → right, expanded → down */
                          expanded ? 'rotate-180' : '-rotate-90'
                        )}
                      />
                    ) : (
                      <span className="w-3 shrink-0" aria-hidden />
                    )}
                  </div>

                  {hasChildren && expanded ? (
                    <div className="relative mt-1 pl-[14px] before:absolute before:bottom-0 before:left-[6px] before:top-0 before:w-px before:bg-[#e8e8e8]">
                      <div className="flex flex-col gap-1">
                        {children.map((child) => {
                          const childName = child.shortName || child.name;
                          return (
                            <div
                              key={child._id}
                              className="relative rounded-[8px] border border-[#ebebeb] bg-white px-[10px] py-2"
                            >
                              <div
                                className="pointer-events-none absolute left-[-8px] top-1/2 h-px w-2 -translate-y-1/2 bg-[#e0e0e0]"
                                aria-hidden
                              />
                              <div className="flex items-center gap-[9px]">
                                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border border-[#e8e8e8] bg-[#f5f5f5] text-[#555]">
                                  <IconSun className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <p className="truncate whitespace-nowrap text-[12px] font-medium leading-tight text-[#333]">
                                    {childName}
                                  </p>
                                  {child.nameEn ? (
                                    <p className="truncate whitespace-nowrap text-[10px] leading-tight text-[#ccc]">
                                      {child.nameEn}
                                    </p>
                                  ) : null}
                                </div>
                                <span
                                  className={cn(
                                    'h-1.5 w-1.5 shrink-0 rounded-full border',
                                    child.isActive
                                      ? 'border-[#555] bg-[#555]'
                                      : 'border-[#ddd] bg-transparent'
                                  )}
                                  title={child.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                                />
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(child)}
                                    className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#e8e8e8] bg-[#fafafa] text-[#444]"
                                    aria-label="Засах"
                                  >
                                    <IconEdit className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(child._id, childName)}
                                    className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[#e8e8e8] bg-[#fafafa] text-[#666]"
                                    aria-label="Устгах"
                                  >
                                    <IconTrash className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <CategoryModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        category={editingCategory}
        onSuccess={() => {
          clearCache(CACHE_KEY);
          fetchCategories(true);
        }}
      />
    </div>
  );
}
