'use client';

import { useState } from 'react';
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
import { useAuthStore } from '@/store/auth-store';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to restore focus when the dialog closes (no Radix Trigger). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function AuthModal({ open, onOpenChange, returnFocusRef }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { setUser, setToken, user } = useAuthStore();
  const { toast } = useToast();
  const mobileDialogClassName =
    "w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-md sm:max-w-md p-4 sm:p-6 max-h-[calc(100dvh-1rem)] overflow-y-auto top-[max(0.5rem,env(safe-area-inset-top))] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]";

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const warmUpBackend = async () => {
    try {
      await api.get('/health', { timeout: 7000 });
      return true;
    } catch (_error) {
      return false;
    }
  };

  const resetForm = () => {
    setPhoneNumber('');
    setName('');
    setPassword('');
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
      requestAnimationFrame(() => {
        returnFocusRef?.current?.focus();
      });
    }
    onOpenChange(isOpen);
  };

  const finishAuthAndClose = () => {
    resetForm();
    onOpenChange(false);
    requestAnimationFrame(() => returnFocusRef?.current?.focus());
  };

  // ========== SIGN UP (directly to our backend) ==========
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user) {
      toast({ title: 'Алдаа', description: 'Та аль хэдийн нэвтэрсэн байна.', variant: 'destructive' });
      return;
    }

    if (!name.trim() || !phoneNumber.trim() || !password.trim()) {
      toast({ title: 'Алдаа', description: 'Бүх талбарыг бөглөнө үү', variant: 'destructive' });
      return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      toast({ title: 'Алдаа', description: 'Нууц үг 4 оронтой тоо байх ёстой', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const isWarm = await warmUpBackend();
      if (!isWarm) {
        toast({
          title: 'Анхааруулга',
          description: 'Сервер сэрж байна. Бүртгэлийг дахин оролдож байна...',
        });
      }

      const response = await api.post('/auth/signup', {
        name: name.trim(),
        phone: phoneNumber.trim(),
        password,
      }, { timeout: 20000 });

      if (response.data.success && response.data.token) {
        const token = response.data.token as string;
        setToken(token);
        localStorage.setItem('token', token);
        setUser({
          ...response.data.user,
          id: response.data.user.id || response.data.user._id,
        });
        toast({ title: 'Бүртгэл амжилттай!' });
        finishAuthAndClose();
        return;
      }

      throw new Error(response.data?.message || 'Бүртгэл үүсгэхэд алдаа гарлаа');
    } catch (firstError: any) {
      try {
        if (firstError.code === 'ECONNABORTED' || firstError.message?.includes('timeout')) {
          await sleep(1500);
          const retryResponse = await api.post('/auth/signup', {
            name: name.trim(),
            phone: phoneNumber.trim(),
            password,
          }, { timeout: 20000 });

          if (retryResponse.data.success && retryResponse.data.token) {
            const token = retryResponse.data.token as string;
            setToken(token);
            localStorage.setItem('token', token);
            setUser({
              ...retryResponse.data.user,
              id: retryResponse.data.user.id || retryResponse.data.user._id,
            });
            toast({ title: 'Бүртгэл амжилттай!' });
            finishAuthAndClose();
            return;
          }

          throw new Error(retryResponse.data?.message || 'Бүртгэл үүсгэхэд алдаа гарлаа');
        } else {
          throw firstError;
        }
      } catch (error: any) {
        console.error('Sign up error:', error);
        const errorMessage =
          error.code === 'ECONNABORTED' || error.message?.includes('timeout')
            ? 'Сервер хариулахад удаан байна. 20-30 секунд хүлээгээд дахин оролдоно уу.'
            : error.response?.data?.message ||
              error.message ||
              (error.code === 'ECONNREFUSED' ? 'Backend сервер ажиллахгүй байна.' : 'Бүртгэл үүсгэхэд алдаа гарлаа');
        toast({ title: 'Алдаа', description: errorMessage, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ========== SIGN IN (directly to our backend) ==========
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim() || !password.trim()) {
      toast({ title: 'Алдаа', description: 'Утасны дугаар болон нууц үг оруулна уу', variant: 'destructive' });
      return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      toast({ title: 'Алдаа', description: 'Нууц үг 4 оронтой тоо байх ёстой', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const signInPayload = {
        phone: phoneNumber.trim(),
        password,
      };

      const isWarm = await warmUpBackend();
      if (!isWarm) {
        toast({
          title: 'Анхааруулга',
          description: 'Сервер сэрж байна. Нэвтрэхийг дахин оролдож байна...',
        });
      }

      let response;
      try {
        response = await api.post('/auth/signin', signInPayload, { timeout: 20000 });
      } catch (firstError: any) {
        // Retry once on timeout to handle cold backend starts
        if (firstError.code === 'ECONNABORTED' || firstError.message?.includes('timeout')) {
          await sleep(1500);
          response = await api.post('/auth/signin', signInPayload, { timeout: 20000 });
        } else {
          throw firstError;
        }
      }

      if (response.data && response.data.success && response.data.token) {
        const token = response.data.token as string;
        setToken(token);
        localStorage.setItem('token', token);
        setUser({
          ...response.data.user,
          id: response.data.user.id || response.data.user._id,
        });
        toast({ title: 'Нэвтрэлт амжилттай!' });
        finishAuthAndClose();
      } else {
        throw new Error(response.data?.message || 'Нэвтрэхэд алдаа гарлаа');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage =
        error.code === 'ECONNABORTED' || error.message?.includes('timeout')
          ? 'Сервер хариулахад удаан байна. 20-30 секунд хүлээгээд дахин оролдоно уу.'
          : error.response?.data?.message ||
            error.message ||
            (error.code === 'ECONNREFUSED' ? 'Backend сервер ажиллахгүй байна.' : 'Нэвтрэхэд алдаа гарлаа');
      toast({ title: 'Алдаа', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ========== RENDER: Main Sign In / Sign Up Form ==========
  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={mobileDialogClassName}>
        <DialogHeader className="space-y-2 md:space-y-3">
          <DialogTitle className="text-xl md:text-2xl">{isSignUp ? 'Бүртгүүлэх' : 'Нэвтрэх'}</DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            {isSignUp 
              ? 'Шинэ бүртгэл үүсгэхийн тулд нэр, утасны дугаар, 4 оронтой нууц үгээ оруулна уу.' 
              : 'Нэвтрэхийн тулд утасны дугаар болон нууц үгээ оруулна уу'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-4 md:space-y-5">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm md:text-base font-medium">Нэр / Байгууллагын нэр *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Нэр эсвэл байгууллагын нэр"
                  className="h-11 md:h-10 text-base md:text-sm"
                />
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm md:text-base font-medium">Утасны дугаар *</Label>
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              placeholder="**** ****"
              className="h-11 md:h-10 text-base md:text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm md:text-base font-medium">Нууц үг (4 орон) *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
              maxLength={4}
              pattern="[0-9]{4}"
              inputMode="numeric"
              placeholder="4 оронтой нууц үг"
              className="h-11 md:h-10 text-base md:text-sm"
            />
          </div>

          <Button type="submit" className="w-full h-11 md:h-10 text-base md:text-sm font-medium" disabled={loading}>
            {loading ? 'Түр хүлээнэ үү...' : isSignUp ? 'Бүртгүүлэх' : 'Нэвтрэх'}
          </Button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); resetForm(); }}
            className="text-sm md:text-base text-gray-600 hover:text-black transition-colors font-medium"
          >
            {isSignUp ? 'Аль хэдийн бүртгэлтэй юу? Нэвтрэх' : 'Бүртгэл байхгүй юу? Бүртгүүлэх'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
