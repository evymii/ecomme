'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/profile/Sidebar';
import { PageLoader } from '@/components/ui/Loader';

const cities = ['Улаанбаатар'];
const districts: Record<string, string[]> = {
  'Улаанбаатар': ['Сум/Дүүрэг сонгох'],
};
const khoroo: Record<string, string[]> = {
  'Сум/Дүүрэг сонгох': ['Баг/Хороо сонгох'],
};

export default function ProfilePage() {
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    city: 'Улаанбаатар',
    district: '',
    khoroo: '',
    deliveryAddress: '',
    additionalInfo: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const { toast } = useToast();

  const userRole = user?.role;
  const userId = user ? 'exists' : null;
  useEffect(() => {
    if (!userId) {
      router.push('/');
      return;
    }
    if (userRole === 'admin') {
      router.push('/admin/orders');
      return;
    }
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userRole, router]);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      if (response.data.success && response.data.user) {
        const userData = response.data.user;
        // Update auth store with latest user data
        useAuthStore.getState().setUser({
          id: userData.id || userData._id,
          phoneNumber: userData.phoneNumber,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          address: userData.address
        });
        
        setFormData({
          name: userData.name || '',
          phoneNumber: userData.phoneNumber || '',
          email: userData.email || '',
          city: userData.address?.city || 'Улаанбаатар',
          district: userData.address?.district || '',
          khoroo: userData.address?.khoroo || '',
          deliveryAddress: userData.address?.deliveryAddress || '',
          additionalInfo: userData.address?.additionalInfo || '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      if (error.response?.status === 401) {
        // Unauthorized, redirect to home
        useAuthStore.getState().logout();
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put('/users/profile', {
        name: formData.name,
        address: {
          city: formData.city,
          district: formData.district,
          khoroo: formData.khoroo,
          deliveryAddress: formData.deliveryAddress,
          additionalInfo: formData.additionalInfo,
        },
      });
      
      if (response.data.success && response.data.user) {
        // Update auth store with updated user data
        useAuthStore.getState().setUser({
          id: response.data.user.id || response.data.user._id,
          phoneNumber: response.data.user.phoneNumber,
          email: response.data.user.email,
          name: response.data.user.name,
          role: response.data.user.role,
          address: response.data.user.address
        });
      }
      
      toast({
        title: 'Амжилттай',
        description: 'Профайл шинэчлэгдлээ',
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
        router.push('/');
      }
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FCFCFC] flex flex-col">
      <Header />
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <Sidebar />
          <div className="flex-1">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-lg md:text-2xl font-semibold md:font-bold">Миний профайл</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                {loading ? (
                  <PageLoader />
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="lastName">Овог *</Label>
                        <Input id="lastName" required />
                      </div>
                      <div>
                        <Label htmlFor="firstName">Нэр *</Label>
                        <Input
                          id="firstName"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">Утасны дугаар *</Label>
                        <Input
                          id="phone"
                          value={formData.phoneNumber}
                          disabled
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Имэйл хаяг *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          disabled
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="city">Хот / Аймаг *</Label>
                        <Select
                          value={formData.city}
                          onValueChange={(value) => setFormData({ ...formData, city: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {cities.map((city) => (
                              <SelectItem key={city} value={city}>
                                {city}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="district">Сум / Дүүрэг *</Label>
                        <Select
                          value={formData.district}
                          onValueChange={(value) => setFormData({ ...formData, district: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Сум/Дүүрэг сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            {districts[formData.city]?.map((district) => (
                              <SelectItem key={district} value={district}>
                                {district}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="khoroo">Баг / Хороо *</Label>
                        <Select
                          value={formData.khoroo}
                          onValueChange={(value) => setFormData({ ...formData, khoroo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Баг/Хороо сонгох" />
                          </SelectTrigger>
                          <SelectContent>
                            {khoroo[formData.district]?.map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Хүргэлтийн хаяг *</Label>
                      <textarea
                        id="address"
                        value={formData.deliveryAddress}
                        onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
                        required
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="additional">Нэмэлт мэдээлэл</Label>
                      <textarea
                        id="additional"
                        value={formData.additionalInfo}
                        onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                        rows={3}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>

                    <Button type="submit" disabled={saving}>
                      {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
