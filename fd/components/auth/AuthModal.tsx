'use client';

import { useState } from 'react';
import { useSignUp } from '@clerk/nextjs';
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
import { CheckCircle2 } from 'lucide-react';

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
  
  // OTP verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const { setUser, setToken, user } = useAuthStore();
  const { toast } = useToast();
  
  // Clerk hook — only used for email verification during signup
  const { signUp: clerkSignUp, isLoaded: signUpLoaded } = useSignUp();

  const resetForm = () => {
    setPhoneNumber('');
    setEmail('');
    setName('');
    setPassword('');
    setOtpCode('');
    setPendingVerification(false);
    setShowSuccess(false);
    setSuccessMessage('');
  };

  // ========== Helper: Create user in our backend ==========
  const createBackendUser = async () => {
    const response = await api.post('/auth/signup', {
      phoneNumber: phoneNumber.trim(),
      email: email.trim(),
      name: name.trim(),
      password: password,
      emailVerified: true,
    });

    if (response.data.success) {
      setToken(response.data.token);
      setUser({
        ...response.data.user,
        id: response.data.user.id || response.data.user._id,
      });

      setSuccessMessage(`Сайн байна уу, ${name.trim()}! Бүртгэл амжилттай баталгаажлаа.`);
      setShowSuccess(true);

      setTimeout(() => {
        resetForm();
        onOpenChange(false);
      }, 2000);
      return true;
    } else {
      throw new Error(response.data?.message || 'Backend бүртгэлд алдаа гарлаа');
    }
  };

  // ========== Helper: Handle existing Clerk account ==========
  // Since Clerk passwords are random, we check our own backend instead
  const handleExistingClerkAccount = async () => {
    // Check if this email actually exists in our backend
    const checkRes = await api.post('/auth/check-email', { email: email.trim() });
    if (checkRes.data.exists) {
      // Email really exists in our backend — user should sign in
      toast({
        title: 'Алдаа',
        description: 'Энэ имэйл хаяг аль хэдийн бүртгэлтэй байна. Нэвтрэх хэсгээр орно уу.',
        variant: 'destructive',
      });
    } else {
      // Email does NOT exist in our backend — it's a stale Clerk record
      // Bypass Clerk and create user directly in our backend
      await createBackendUser();
    }
  };

  // ========== SIGN UP (Step 1: Verify email via Clerk) ==========
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user) {
      toast({ title: 'Алдаа', description: 'Та аль хэдийн нэвтэрсэн байна.', variant: 'destructive' });
      return;
    }

    if (!signUpLoaded || !clerkSignUp) {
      toast({ title: 'Алдаа', description: 'Clerk ачаалагдаагүй байна. Хуудсыг дахин ачаалаарай.', variant: 'destructive' });
      return;
    }

    if (!name.trim() || !email.trim() || !phoneNumber.trim() || !password.trim()) {
      toast({ title: 'Алдаа', description: 'Бүх талбарыг бөглөнө үү', variant: 'destructive' });
      return;
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      toast({ title: 'Алдаа', description: 'Нууц үг 4 оронтой тоо байх ёстой', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Generate a strong random password for Clerk only (we don't use Clerk for sign-in)
      // This avoids Clerk's "password too simple" / "pwned password" errors
      const randomPart = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const clerkPassword = `Az!${randomPart}Sv#${Date.now()}`;
      
      try {
        // Try creating a new Clerk account
        await clerkSignUp.create({
          emailAddress: email.trim(),
          password: clerkPassword,
        });

        // Send email verification code (OTP)
        await clerkSignUp.prepareEmailAddressVerification({
          strategy: 'email_code',
        });

        setPendingVerification(true);
        toast({
          title: 'Код илгээлээ',
          description: `${email} хаяг руу баталгаажуулах код илгээлээ. Имэйлээ шалгана уу.`,
          duration: 6000,
        });
      } catch (clerkError: any) {
        const errorCode = clerkError.errors?.[0]?.code || '';
        const errorMsg = clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || '';
        
        if (errorCode === 'form_identifier_exists' || errorMsg.includes('already') || errorMsg.includes('taken')) {
          // Email exists in Clerk (stale record from previous attempt)
          // Check our own backend to decide what to do
          try {
            await handleExistingClerkAccount();
          } catch (fallbackErr: any) {
            console.error('Existing account fallback error:', fallbackErr);
            toast({
              title: 'Алдаа',
              description: fallbackErr.response?.data?.message || 'Бүртгэл шалгахад алдаа гарлаа. Дахин оролдоно уу.',
              variant: 'destructive',
            });
          }
        } else if (errorMsg.includes('email')) {
          toast({ title: 'Алдаа', description: 'Имэйл хаяг буруу байна', variant: 'destructive' });
        } else {
          toast({ title: 'Алдаа', description: errorMsg || 'Бүртгэл үүсгэхэд алдаа гарлаа', variant: 'destructive' });
        }
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast({ title: 'Алдаа', description: error.message || 'Бүртгэл үүсгэхэд алдаа гарлаа', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ========== SIGN UP (Step 2: Verify OTP → Create user in our backend) ==========
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode.trim()) {
      toast({ title: 'Алдаа', description: 'Баталгаажуулах кодыг оруулна уу', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (!signUpLoaded || !clerkSignUp) {
        toast({ title: 'Алдаа', description: 'Clerk ачаалагдаагүй байна', variant: 'destructive' });
        return;
      }

      const result = await clerkSignUp.attemptEmailAddressVerification({
        code: otpCode.trim(),
      });

      if (result.status === 'complete') {
        // Email verified! Create user in our backend
        try {
          await createBackendUser();
        } catch (backendError: any) {
          console.error('Backend signup error:', backendError);
          toast({
            title: 'Анхааруулга',
            description: backendError.response?.data?.message || 'Имэйл баталгаажсан. Серверт алдаа гарлаа, дахин нэвтрэнэ үү.',
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Алдаа', description: 'Баталгаажуулалт дуусаагүй байна. Дахин оролдоно уу.', variant: 'destructive' });
      }
    } catch (error: any) {
      console.error('OTP verification error:', JSON.stringify(error.errors || error.message || error));
      
      let errorMessage = 'Баталгаажуулахад алдаа гарлаа';
      if (error.errors && error.errors.length > 0) {
        const clerkErr = error.errors[0];
        const code = clerkErr.code || '';
        const msg = clerkErr.longMessage || clerkErr.message || '';
        
        if (code === 'form_code_incorrect' || msg.includes('incorrect') || msg.includes('invalid')) {
          errorMessage = 'Баталгаажуулах код буруу байна';
        } else if (msg.includes('expired')) {
          errorMessage = 'Код хүчинтэй хугацаа дууссан. Дахин илгээнэ үү.';
        } else {
          errorMessage = msg || errorMessage;
        }
      }
      
      toast({ title: 'Алдаа', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ========== RESEND OTP ==========
  const handleResendOtp = async () => {
    try {
      if (!signUpLoaded || !clerkSignUp) return;
      await clerkSignUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      toast({ title: 'Код дахин илгээлээ', description: `${email} руу шинэ код илгээлээ` });
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      toast({ title: 'Алдаа', description: 'Код илгээхэд алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.', variant: 'destructive' });
    }
  };

  // ========== SIGN IN (directly to our backend, no Clerk) ==========
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
      const response = await api.post('/auth/signin', {
        phoneNumber: phoneNumber.trim(),
        password,
      });

      if (response.data && response.data.success) {
        setToken(response.data.token);
        setUser({
          ...response.data.user,
          id: response.data.user.id || response.data.user._id,
        });

        // Show success screen
        setSuccessMessage(`Сайн байна уу, ${response.data.user.name || 'Хэрэглэгч'}! Нэвтрэх амжилттай.`);
        setShowSuccess(true);

        // Auto close after 2 seconds
        setTimeout(() => {
          resetForm();
          onOpenChange(false);
        }, 2000);
      } else {
        throw new Error(response.data?.message || 'Нэвтрэхэд алдаа гарлаа');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          (error.code === 'ECONNREFUSED' ? 'Backend сервер ажиллахгүй байна.' : 'Нэвтрэхэд алдаа гарлаа');
      toast({ title: 'Алдаа', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ========== RENDER: Success Screen ==========
  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { resetForm(); } onOpenChange(isOpen); }}>
        <DialogContent className="max-w-md sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Амжилттай!</h2>
            <p className="text-sm text-gray-600">{successMessage}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ========== RENDER: OTP Verification Step ==========
  if (pendingVerification) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader className="space-y-2 md:space-y-3">
            <DialogTitle className="text-xl md:text-2xl">Имэйл баталгаажуулалт</DialogTitle>
            <DialogDescription className="text-sm md:text-base">
              <span className="font-medium text-[#02111B]">{email}</span> хаяг руу 6 оронтой код илгээлээ.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyOtp} className="space-y-4 md:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-sm md:text-base font-medium">Баталгаажуулах код *</Label>
              <Input
                id="otp"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="______"
                className="h-11 md:h-10 text-base md:text-sm text-center tracking-[0.5em] font-mono"
                maxLength={6}
                autoFocus
              />
            </div>

            <Button type="submit" className="w-full h-11 md:h-10 text-base md:text-sm font-medium" disabled={loading}>
              {loading ? 'Шалгаж байна...' : 'Баталгаажуулах'}
            </Button>
          </form>

          <div className="text-center pt-2">
            <button type="button" onClick={handleResendOtp} className="text-sm md:text-base text-gray-600 hover:text-black transition-colors font-medium">
              Код дахин илгээх
            </button>
          </div>
          <div className="text-center">
            <button type="button" onClick={() => { setPendingVerification(false); setOtpCode(''); }} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              ← Буцах
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ========== RENDER: Main Sign In / Sign Up Form ==========
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) resetForm(); onOpenChange(isOpen); }}>
      <DialogContent className="max-w-md sm:max-w-md">
        <DialogHeader className="space-y-2 md:space-y-3">
          <DialogTitle className="text-xl md:text-2xl">{isSignUp ? 'Бүртгүүлэх' : 'Нэвтрэх'}</DialogTitle>
          <DialogDescription className="text-sm md:text-base">
            {isSignUp 
              ? 'Шинэ бүртгэл үүсгэхийн тулд мэдээллээ оруулна уу. Имэйл баталгаажуулалт шаардлагатай.' 
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
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-base font-medium">Имэйл хаяг *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@gmail.com"
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
              placeholder="****"
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
