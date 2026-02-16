'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import { Trash2, KeyRound } from 'lucide-react';

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

  // Password change modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

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
  }, [isAdmin]);

  const handleRoleChange = async (userId: string, currentRole: string, newRole: 'admin' | 'user') => {
    if (currentRole === newRole) return;

    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
    );

    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast({
        title: 'Амжилттай',
        description: `Эрх "${newRole === 'admin' ? 'Админ' : 'Хэрэглэгч'}" болгож шинэчлэгдлээ`,
      });
    } catch (error: any) {
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: currentRole as 'admin' | 'user' } : u))
      );
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`"${user.name || user.phoneNumber}" хэрэглэгчийг устгахдаа итгэлтэй байна уу?`)) return;

    try {
      await api.delete(`/admin/users/${user._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
      toast({
        title: 'Амжилттай',
        description: 'Хэрэглэгч устгагдлаа',
      });
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Хэрэглэгч устгахад алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setPasswordModalOpen(true);
  };

  const handleChangePassword = async () => {
    if (!selectedUser) return;

    if (!newPassword || newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      toast({
        title: 'Алдаа',
        description: 'Нууц үг 4 оронтой тоо байх ёстой',
        variant: 'destructive',
      });
      return;
    }

    setPasswordLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser._id}/password`, { password: newPassword });
      toast({
        title: 'Амжилттай',
        description: `"${selectedUser.name || selectedUser.phoneNumber}" хэрэглэгчийн нууц үг солигдлоо`,
      });
      setPasswordModalOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Нууц үг солиход алдаа гарлаа',
        variant: 'destructive',
      });
    } finally {
      setPasswordLoading(false);
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
          <PageLoader />
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
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">УТАС</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm hidden md:table-cell">ИМЭЙЛ</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">ЭРХ</th>
                      <th className="text-left py-2 px-2 md:py-3 md:px-4 font-medium text-xs md:text-sm">ҮЙЛДЛҮҮД</th>
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
                          <td className="py-2 px-2 md:py-3 md:px-4 text-xs md:text-sm hidden md:table-cell">{u.email || '-'}</td>
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <Select
                              value={u.role}
                              onValueChange={(value: 'admin' | 'user') =>
                                handleRoleChange(u._id, u.role, value)
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
                          <td className="py-2 px-2 md:py-3 md:px-4">
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPasswordModal(u)}
                                title="Нууц үг солих"
                                className="h-8 w-8 p-0"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(u)}
                                title="Хэрэглэгч устгах"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:border-red-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Password Modal */}
        <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Нууц үг солих</DialogTitle>
              <DialogDescription>
                {selectedUser?.name || selectedUser?.phoneNumber} хэрэглэгчийн нууц үг солих
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="newPassword">Шинэ нууц үг (4 оронтой тоо)</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="0000"
                  value={newPassword}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setNewPassword(val);
                  }}
                  autoComplete="off"
                  className="text-center text-lg tracking-[0.5em] font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPasswordModalOpen(false)}
                >
                  Цуцлах
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordLoading || newPassword.length !== 4}
                >
                  {passwordLoading ? 'Хадгалж байна...' : 'Хадгалах'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
