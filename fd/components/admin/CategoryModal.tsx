'use client';

import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface Category {
  _id: string;
  name: string;
  nameEn?: string;
  description?: string;
  isActive: boolean;
}

interface CategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSuccess: () => void;
}

export default function CategoryModal({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    description: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        nameEn: category.nameEn || '',
        description: category.description || '',
        isActive: category.isActive,
      });
    } else {
      setFormData({
        name: '',
        nameEn: '',
        description: '',
        isActive: true,
      });
    }
  }, [category, open]);

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
      if (category) {
        await api.put(`/admin/categories/${category._id}`, formData);
        toast({ title: 'Амжилттай', description: 'Ангилал шинэчлэгдлээ' });
      } else {
        await api.post('/admin/categories', formData);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Ангилал засах' : 'Шинэ ангилал нэмэх'}
          </DialogTitle>
          <DialogDescription>
            {category ? 'Ангиллын мэдээллийг засах' : 'Шинэ ангиллын мэдээллийг оруулна уу'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Ангиллын нэр *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Жишээ: Бичиг хэрэг"
            />
          </div>

          <div>
            <Label htmlFor="nameEn">Ангиллын нэр (Англи) </Label>
            <Input
              id="nameEn"
              value={formData.nameEn}
              onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
              placeholder="Example: Stationery"
            />
          </div>

          <div>
            <Label htmlFor="description">Тайлбар</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Ангиллын тайлбар"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Идэвхтэй
            </Label>
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
