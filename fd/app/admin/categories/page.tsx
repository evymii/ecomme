'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import AdminNav from '@/components/admin/AdminNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CategoryModal from '@/components/admin/CategoryModal';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2 } from 'lucide-react';

interface Category {
  _id: string;
  name: string;
  nameEn?: string;
  description?: string;
  isActive: boolean;
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const fetchCategories = async () => {
    try {
      const response = await api.get('/admin/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isChecking]);

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
      fetchCategories();
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>Шалгаж байна...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <AdminNav />
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

        {loading ? (
          <div className="text-center py-8 md:py-12 text-sm md:text-base">Ачааллаж байна...</div>
        ) : (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {categories.map((category) => (
                    <div
                      key={category._id}
                      className="border rounded-lg p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 hover:bg-gray-50"
                    >
                      <div className="flex-1">
                        <h3 className="text-sm md:text-lg font-semibold">{category.name}</h3>
                        {category.nameEn && (
                          <p className="text-xs md:text-sm text-gray-500">{category.nameEn}</p>
                        )}
                        {category.description && (
                          <p className="text-xs md:text-sm text-gray-600 mt-1">{category.description}</p>
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
                      <div className="flex gap-2 md:ml-4">
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
          onSuccess={fetchCategories}
        />
      </main>
    </div>
  );
}
