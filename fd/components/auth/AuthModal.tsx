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
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser, setToken, user } = useAuthStore();
  const { toast } = useToast();

  // Check if user is already signed in when opening signup
  const handleSignUpClick = () => {
    if (user) {
      toast({
        title: 'Алдаа',
        description: 'Та аль хэдийн нэвтэрсэн байна. Гараад дахин оролдоно уу.',
        variant: 'destructive',
      });
      return;
    }
    setIsSignUp(true);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!phoneNumber || !password) {
      toast({
        title: 'Алдаа',
        description: 'Утасны дугаар болон нууц үг оруулна уу',
        variant: 'destructive',
      });
      return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      toast({
        title: 'Алдаа',
        description: 'Нууц үг 4 оронтой тоо байх ёстой',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting sign in with:', { phoneNumber, passwordLength: password.length });
      
      const response = await api.post('/auth/signin', {
        phoneNumber: phoneNumber.trim(),
        password,
      });
      
      console.log('Sign in response:', response.data);
      
      if (response.data && response.data.success) {
        setToken(response.data.token);
        setUser({
          ...response.data.user,
          id: response.data.user.id || response.data.user._id
        });
        onOpenChange(false);
        // Clear form
        setPhoneNumber('');
        setPassword('');
        
        // Show success confirmation
        toast({
          title: 'Амжилттай',
          description: `Сайн байна уу, ${response.data.user.name || 'Хэрэглэгч'}! Нэвтрэх амжилттай.`,
          duration: 3000,
        });
      } else {
        throw new Error(response.data?.message || 'Нэвтрэхэд алдаа гарлаа');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          (error.code === 'ECONNREFUSED' ? 'Backend сервер ажиллахгүй байна. Backend серверийг эхлүүлнэ үү.' : 'Нэвтрэхэд алдаа гарлаа');
      toast({
        title: 'Алдаа',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if user is already signed in
    if (user) {
      toast({
        title: 'Алдаа',
        description: 'Та аль хэдийн нэвтэрсэн байна. Гараад дахин оролдоно уу.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post('/auth/signup', {
        phoneNumber,
        email,
        name,
        password,
      });
      
      if (response.data.success) {
        setToken(response.data.token);
        setUser({
          ...response.data.user,
          id: response.data.user.id || response.data.user._id
        });
        onOpenChange(false);
        // Clear form
        setPhoneNumber('');
        setEmail('');
        setName('');
        setPassword('');
        toast({
          title: 'Амжилттай',
          description: 'Бүртгэл амжилттай',
        });
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          (error.code === 'ECONNREFUSED' ? 'Backend сервер ажиллахгүй байна. Backend серверийг эхлүүлнэ үү.' : 'Бүртгэл үүсгэхэд алдаа гарлаа');
      toast({
        title: 'Алдаа',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader className="space-y-2 md:space-y-3">
          <DialogTitle className="text-xl md:text-2xl">{isSignUp ? 'Бүртгүүлэх' : 'Нэвтрэх'}</DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            {isSignUp ? 'Шинэ бүртгэл үүсгэхийн тулд мэдээллээ оруулна уу' : 'Нэвтрэхийн тулд утасны дугаар болон нууц үгээ оруулна уу'}
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
                  placeholder="Нэр оруулна уу"
                  className="h-11 md:h-10 text-base md:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base font-medium">Имэйл хаяг *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="имэйл@example.com"
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
              placeholder="99958980"
              className="h-11 md:h-10 text-base md:text-sm"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm md:text-base font-medium">Нууц үг (4 орон) *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={4}
              pattern="[0-9]{4}"
              placeholder="8980"
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
            onClick={() => {
              if (isSignUp) {
                setIsSignUp(false);
              } else {
                handleSignUpClick();
              }
            }}
            className="text-sm md:text-base text-gray-600 hover:text-black transition-colors font-medium"
          >
            {isSignUp ? 'Аль хэдийн бүртгэлтэй юу? Нэвтрэх' : 'Бүртгэл байхгүй юу? Бүртгүүлэх'}
          </button>
        </div>

        {!isSignUp && (
          <div className="text-center pt-2">
            <p className="text-sm md:text-base text-gray-500 mb-3 md:mb-2">эсвэл</p>
            <Button variant="outline" className="w-full h-11 md:h-10 text-base md:text-sm">
              Зочноор нэвтрэх
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
