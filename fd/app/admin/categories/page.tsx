'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CategoryModal from '@/components/admin/CategoryModal';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2 } from 'lucide-react';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { getCache, setCache, clearCache } from '@/lib/admin-cache';

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
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const CACHE_KEY = 'admin_categories';

  const fetchCategories = useCallback(async (skipCache = false) => {
    // Try cache first
    if (!skipCache) {
      const cached = getCache<Category[]>(CACHE_KEY, 120_000);
      if (cached) {
        setCategories(cached);
        setLoading(false);
        api.get('/admin/categories')
          .then(res => {
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
  }, [toast]);

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchCategories();
    }
  }, [isAdmin, isChecking, fetchCategories]);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Энэ ангиллыг устгахдаа итгэлтэй байна уу?')) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      toast({
        title: 'Амжилттай',
        description: 'Ангилал устгагдлаа',
      });
      clearCache(CACHE_KEY);
      fetchCategories(true);
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 mb-4 md:mb-8">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold md:font-bold mb-1 md:mb-2">
              Ангиллын удирдлага
            </h1>
            <p className="text-gray-600 text-xs md:text-base">
              Бүх ангиллыг удирдах
            </p>
          </div>
          <Button 
            onClick={() => {
              setEditingCategory(null);
              setModalOpen(true);
            }}
            size="sm"
            className="w-full md:w-auto"
          >
            Ангилал нэмэх
          </Button>
        </div>

        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : (
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg font-semibold md:font-bold">Ангиллууд ({categories.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              {categories.length === 0 ? (
                <div className="text-center py-8 md:py-12 text-xs md:text-sm text-gray-500">
                  Ангилал олдсонгүй
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
                  {categories.map((category) => (
                    <div
                      key={category._id}
                      className="border rounded-lg p-2.5 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0 hover:bg-gray-50 overflow-x-hidden"
                    >
                      <div className="flex-1">
                        <h3 className="text-sm md:text-lg font-semibold leading-tight">
                          {category.shortName || category.name}
                        </h3>
                        {category.parentName && (
                          <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
                            Parent: {category.parentName}
                          </p>
                        )}
                        {category.nameEn && (
                          <p className="text-[11px] md:text-sm text-gray-500 leading-tight">{category.nameEn}</p>
                        )}
                        {category.description && (
                          <p className="text-[11px] md:text-sm text-gray-600 mt-1 line-clamp-2">{category.description}</p>
                        )}
                        <span
                          className={`inline-block mt-2 px-2 py-1 rounded text-[10px] md:text-xs ${
                            category.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {category.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                        </span>
                      </div>
                      <div className="flex gap-2 md:ml-4 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(category)}
                          className="h-8 md:h-9"
                        >
                          <Edit className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(category._id)}
                          className="h-8 md:h-9"
                        >
                          <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <CategoryModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          category={editingCategory}
          onSuccess={() => { clearCache(CACHE_KEY); fetchCategories(true); }}
        />
      </main>
    </div>
  );
}
