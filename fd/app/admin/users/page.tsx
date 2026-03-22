'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import Loader from '@/components/ui/Loader';
import { PageLoader } from '@/components/ui/Loader';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { getCache, setCache, clearCache } from '@/lib/admin-cache';
import { cn } from '@/lib/utils';

interface User {
  _id: string;
  phoneNumber: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt?: string;
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" stroke="#555" strokeWidth="1.8" />
      <path
        d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
        stroke="#555"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="11"
        width="18"
        height="11"
        rx="2"
        stroke="#555"
        strokeWidth="1.8"
      />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke="#555"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <polyline
        points="3 6 5 6 21 6"
        stroke="#888"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="#888"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="#888"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 6V4h6v2"
        stroke="#888"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const showLoader = useDelayedLoading(loading, 250);
  const { isAdmin, isChecking } = useAdminAuth();
  const { toast } = useToast();

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const CACHE_KEY = 'admin_users';

  const fetchUsers = useCallback(
    async (skipCache = false) => {
      if (!skipCache) {
        const cached = getCache<User[]>(CACHE_KEY, 60_000);
        if (cached) {
          setUsers(cached);
          setLoading(false);
          api
            .get('/admin/users')
            .then((res) => {
              if (res.data?.success) {
                setUsers(res.data.users || []);
                setCache(CACHE_KEY, res.data.users || []);
              }
            })
            .catch(() => {});
          return;
        }
      }

      try {
        const response = await api.get('/admin/users');
        if (!response.data?.success) {
          toast({
            title: 'Алдаа',
            description: response.data?.message || 'Хэрэглэгчид авахад алдаа гарлаа',
            variant: 'destructive',
          });
          return;
        }
        const data = response.data.users || [];
        setUsers(data);
        setCache(CACHE_KEY, data);
      } catch (error: any) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Алдаа',
          description:
            error.response?.data?.message || 'Хэрэглэгчид авахад алдаа гарлаа',
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
      fetchUsers();
    }
  }, [isAdmin, isChecking, fetchUsers]);

  const handleRoleChange = async (
    userId: string,
    currentRole: string,
    newRole: 'admin' | 'user'
  ) => {
    if (currentRole === newRole) return;

    setUsers((prev) =>
      prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
    );

    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      clearCache(CACHE_KEY);
      toast({
        title: 'Амжилттай',
        description: `Эрх "${newRole === 'admin' ? 'Админ' : 'Хэрэглэгч'}" болгож шинэчлэгдлээ`,
      });
    } catch (error: any) {
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, role: currentRole as 'admin' | 'user' } : u
        )
      );
      toast({
        title: 'Алдаа',
        description: error.response?.data?.message || 'Алдаа гарлаа',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (user: User) => {
    if (
      !confirm(`"${user.name || user.phoneNumber}" хэрэглэгчийг устгахдаа итгэлтэй байна уу?`)
    )
      return;

    try {
      await api.delete(`/admin/users/${user._id}`);
      clearCache(CACHE_KEY);
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
      await api.put(`/admin/users/${selectedUser._id}/password`, {
        password: newPassword,
      });
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

  const selectTriggerClass = cn(
    'h-[30px] w-[96px] shrink-0 border border-[#e0e0e0] bg-[#fafafa] px-2 py-0 text-[11px] leading-none text-[#333]',
    'rounded-lg shadow-none focus:ring-1 focus:ring-[#d0d0d0] focus:ring-offset-0',
    '[&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-[#555]'
  );

  const selectContentClass =
    'border border-[#ececec] bg-white text-[#111] shadow-md [&_[data-highlighted]]:bg-[#f5f5f5] [&_[data-highlighted]]:text-[#111]';

  const selectItemClass =
    'text-[11px] focus:bg-[#f5f5f5] focus:text-[#111] data-[highlighted]:bg-[#f5f5f5]';

  if (isChecking) {
    return <Loader />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="mx-auto max-w-4xl bg-white">
        <header className="border-b border-[#f0f0f0] px-4 py-4">
          <h1 className="text-[17px] font-medium leading-tight text-[#111]">
            Хэрэглэгчдийн удирдлага
          </h1>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-[12px] leading-snug text-[#888]">
              Системийн бүх хэрэглэгчийг удирдах
            </p>
            {!loading && (
              <span className="shrink-0 rounded-[20px] border border-[#e8e8e8] bg-[#f5f5f5] px-2 py-0.5 text-[11px] leading-none text-[#111]">
                {users.length} хэрэглэгч
              </span>
            )}
          </div>
        </header>

        {loading && showLoader ? (
          <PageLoader />
        ) : loading ? null : (
          <div className="px-3 py-2.5 md:px-4">
            {users.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-[#888]">
                Хэрэглэгч олдсонгүй
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {users.map((u) => (
                  <li
                    key={u._id}
                    className="flex h-14 min-h-[56px] flex-nowrap items-center gap-[10px] rounded-[10px] border border-[#ececec] bg-white px-3 py-2.5"
                    title={
                      u.email
                        ? `${u.name || u.phoneNumber} — ${u.email}`
                        : undefined
                    }
                  >
                    <div
                      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-[#e8e8e8] bg-[#f5f5f5]"
                      aria-hidden
                    >
                      <IconPerson className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium leading-tight text-[#111]">
                        {u.name || '—'}
                      </p>
                      <p className="truncate text-[11px] leading-tight text-[#888]">
                        {u.phoneNumber || '—'}
                      </p>
                    </div>
                    <Select
                      value={u.role}
                      onValueChange={(value: 'admin' | 'user') =>
                        handleRoleChange(u._id, u.role, value)
                      }
                    >
                      <SelectTrigger
                        className={selectTriggerClass}
                        aria-label="Эрх сонгох"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        <SelectItem value="user" className={selectItemClass}>
                          Хэрэглэгч
                        </SelectItem>
                        <SelectItem value="admin" className={selectItemClass}>
                          Админ
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => openPasswordModal(u)}
                      title="Нууц үг солих"
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] bg-[#fafafa] transition-opacity hover:opacity-80"
                    >
                      <IconLock className="h-[14px] w-[14px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(u)}
                      title="Хэрэглэгч устгах"
                      className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] bg-[#fafafa] transition-opacity hover:opacity-80"
                    >
                      <IconTrash className="h-[14px] w-[14px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
          <DialogContent className="max-w-sm border border-[#ececec] bg-white">
            <DialogHeader>
              <DialogTitle className="text-[#111]">Нууц үг солих</DialogTitle>
              <DialogDescription className="text-[#888]">
                {selectedUser?.name || selectedUser?.phoneNumber} хэрэглэгчийн нууц үг солих
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="newPassword" className="text-[#111]">
                  Шинэ нууц үг (4 оронтой тоо)
                </Label>
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
                  className="mt-1.5 border-[#e0e0e0] bg-[#fafafa] text-center text-lg font-mono tracking-[0.5em] text-[#111] focus-visible:ring-[#d0d0d0]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPasswordModalOpen(false)}
                  className="border-[#e0e0e0] bg-white text-[#111] hover:bg-[#fafafa]"
                >
                  Цуцлах
                </Button>
                <Button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={passwordLoading || newPassword.length !== 4}
                  className="bg-[#111] text-white hover:bg-[#333]"
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
