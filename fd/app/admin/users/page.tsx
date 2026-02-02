'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import AdminNav from '@/components/admin/AdminNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';

interface User {
  _id: string;
  phoneNumber: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !isChecking) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isChecking]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast({
        title: 'Амжилттай',
        description: 'Хэрэглэгчийн эрх шинэчлэгдлээ',
      });
      fetchUsers();
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 md:mb-8">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold md:font-bold mb-2 md:mb-4">
              Хэрэглэгчдийн удирдлага
            </h1>
            <p className="text-gray-600 text-xs md:text-base">
              Системийн бүх хэрэглэгчдийг удирдах
            </p>
          </div>
          {!loading && (
            <div className="mt-2 md:mt-0">
              <p className="text-sm md:text-base font-medium text-gray-700">
                Нийт хэрэглэгч: <span className="font-bold text-black">{users.length}</span>
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 md:py-12 text-sm md:text-base">Ачааллаж байна...</div>
        ) : (
          <Card>
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg font-semibold md:font-bold">Хэрэглэгчид</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6">
              <div className="overflow-x-auto -mx-3 md:mx-0">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">НЭР</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">УТАСНЫ ДУГААР</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">ИМЭЙЛ</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">ЭРХ</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm hidden md:table-cell">ҮЙЛДЛҮҮД</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 md:py-8 text-xs md:text-sm text-gray-500">
                          Хэрэглэгч олдсонгүй
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u._id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 md:py-3 md:px-4 font-medium">{u.name || '-'}</td>
                          <td className="py-2 px-2 md:py-3 md:px-4 text-xs md:text-sm">{u.phoneNumber || '-'}</td>
                          <td className="py-2 px-2 md:py-3 md:px-4 text-xs md:text-sm">{u.email || '-'}</td>
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <Select
                              value={u.role}
                              onValueChange={(value: 'admin' | 'user') =>
                                handleRoleChange(u._id, value)
                              }
                            >
                              <SelectTrigger className="w-24 md:w-32 h-8 md:h-10 text-xs md:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">Хэрэглэгч</SelectItem>
                                <SelectItem value="admin">Админ</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 px-2 md:py-3 md:px-4 hidden md:table-cell">-</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
