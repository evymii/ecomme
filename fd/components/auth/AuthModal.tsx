'use client';

import { useState, useEffect, useRef } from 'react';
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

/** Log Clerk API errors (includes `.errors[]` with `longMessage`). */
function logClerkError(context: string, err: unknown) {
  const e = err as {
    errors?: Array<{ code?: string; longMessage?: string; message?: string; meta?: unknown }>;
    message?: string;
  };
  const payload = e?.errors ?? err;
  console.error(`Clerk ${context}:`, JSON.stringify(payload, null, 2));
  return (
    e?.errors?.[0]?.longMessage ??
    e?.errors?.[0]?.message ??
    (typeof e?.message === 'string' ? e.message : null)
  );
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Element to restore focus when the dialog closes (no Radix Trigger). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

export default function AuthModal({ open, onOpenChange, returnFocusRef }: AuthModalProps) {
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
  
  // Clerk: email OTP for sign-up; setActive completes the Clerk session after OTP (required for reliable delivery / state).
  const { isLoaded: signUpLoaded, signUp: clerkSignUp, setActive } = useSignUp();

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

  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const resetFormRef = useRef(resetForm);
  resetFormRef.current = resetForm;

  useEffect(() => {
    if (!showSuccess) return;
    const id = window.setTimeout(() => {
      resetFormRef.current();
      onOpenChangeRef.current(false);
      requestAnimationFrame(() => returnFocusRef?.current?.focus());
    }, 2000);
    return () => clearTimeout(id);
  }, [showSuccess, returnFocusRef]);

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
      requestAnimationFrame(() => {
        returnFocusRef?.current?.focus();
      });
    }
    onOpenChange(isOpen);
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

    if (!signUpLoaded || !clerkSignUp || !setActive) {
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
      const randomPart =
        Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      const clerkPassword = `Az!${randomPart}Sv#${Date.now()}`;

      try {
        // Step 1: create sign-up — prefer email-only (matches Dashboard "verification code" OTP flow).
        try {
          await clerkSignUp.create({
            emailAddress: email.trim(),
          });
        } catch (createErr: unknown) {
          logClerkError('signUp.create(email-only)', createErr);
          const err = createErr as { errors?: Array<{ code?: string; meta?: { paramName?: string } }> };
          const needsPassword = err?.errors?.some(
            (x) =>
              x.code === 'form_param_missing' ||
              x.meta?.paramName === 'password' ||
              (x.code ?? '').toLowerCase().includes('password')
          );
          if (needsPassword) {
            await clerkSignUp.create({
              emailAddress: email.trim(),
              password: clerkPassword,
            });
          } else {
            throw createErr;
          }
        }

        // Step 2: send OTP to email (email_code, not link)
        try {
          await clerkSignUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          });
        } catch (prepErr: unknown) {
          const msg = logClerkError('prepareEmailAddressVerification', prepErr);
          toast({
            title: 'Алдаа',
            description: msg ?? 'Код илгээхэд алдаа гарлаа. Clerk тохиргоо (email_code, Development vs Production) шалгана уу.',
            variant: 'destructive',
          });
          return;
        }

        setPendingVerification(true);
        toast({
          title: 'Код илгээлээ',
          description: `${email} хаяг руу баталгаажуулах код илгээлээ. Имэйлээ шалгана уу.`,
          duration: 6000,
        });
      } catch (clerkError: unknown) {
        logClerkError('signUp flow', clerkError);
        const clerkErr = clerkError as {
          errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
        };
        const errorCode = clerkErr.errors?.[0]?.code || '';
        const errorMsg =
          clerkErr.errors?.[0]?.longMessage || clerkErr.errors?.[0]?.message || '';

        if (errorCode === 'form_identifier_exists' || errorMsg.includes('already') || errorMsg.includes('taken')) {
          try {
            await handleExistingClerkAccount();
          } catch (fallbackErr: unknown) {
            console.error('Existing account fallback error:', fallbackErr);
            toast({
              title: 'Алдаа',
              description:
                (fallbackErr as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Бүртгэл шалгахад алдаа гарлаа. Дахин оролдоно уу.',
              variant: 'destructive',
            });
          }
        } else if (errorMsg.toLowerCase().includes('email')) {
          toast({ title: 'Алдаа', description: 'Имэйл хаяг буруу байна', variant: 'destructive' });
        } else {
          toast({
            title: 'Алдаа',
            description: errorMsg || 'Бүртгэл үүсгэхэд алдаа гарлаа',
            variant: 'destructive',
          });
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Sign up error:', error);
      toast({ title: 'Алдаа', description: msg || 'Бүртгэл үүсгэхэд алдаа гарлаа', variant: 'destructive' });
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
      if (!signUpLoaded || !clerkSignUp || !setActive) {
        toast({ title: 'Алдаа', description: 'Clerk ачаалагдаагүй байна', variant: 'destructive' });
        return;
      }

      let result;
      try {
        result = await clerkSignUp.attemptEmailAddressVerification({
          code: otpCode.trim(),
        });
      } catch (verifyErr: unknown) {
        logClerkError('attemptEmailAddressVerification', verifyErr);
        const err = verifyErr as {
          errors?: Array<{ code?: string; longMessage?: string; message?: string }>;
        };
        let errorMessage = err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? 'Баталгаажуулахад алдаа гарлаа';
        const code = err.errors?.[0]?.code || '';
        const msg = (err.errors?.[0]?.longMessage || err.errors?.[0]?.message || '').toLowerCase();
        if (code === 'form_code_incorrect' || msg.includes('incorrect') || msg.includes('invalid')) {
          errorMessage = 'Баталгаажуулах код буруу байна';
        } else if (msg.includes('expired')) {
          errorMessage = 'Код хүчинтэй хугацаа дууссан. Дахин илгээнэ үү.';
        }
        toast({ title: 'Алдаа', description: errorMessage, variant: 'destructive' });
        return;
      }

      if (result.status === 'complete') {
        if (result.createdSessionId) {
          try {
            await setActive({ session: result.createdSessionId });
          } catch (activeErr: unknown) {
            const activeMsg = logClerkError('setActive after OTP', activeErr);
            toast({
              title: 'Анхааруулга',
              description:
                activeMsg ?? 'Clerk session идэвхжүүлэхэд алдаа гарлаа. Backend бүртгэлийг үргэлжлүүлнэ.',
              variant: 'destructive',
            });
          }
        }
        try {
          await createBackendUser();
        } catch (backendError: unknown) {
          const be = backendError as { response?: { data?: { message?: string } } };
          console.error('Backend signup error:', backendError);
          toast({
            title: 'Анхааруулга',
            description: be.response?.data?.message || 'Имэйл баталгаажсан. Серверт алдаа гарлаа, дахин нэвтрэнэ үү.',
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Алдаа', description: 'Баталгаажуулалт дуусаагүй байна. Дахин оролдоно уу.', variant: 'destructive' });
      }
    } catch (error: unknown) {
      logClerkError('handleVerifyOtp unexpected', error);
      toast({
        title: 'Алдаа',
        description:
          (error as { message?: string })?.message || 'Баталгаажуулахад алдаа гарлаа',
        variant: 'destructive',
      });
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
    } catch (err: unknown) {
      const msg = logClerkError('prepareEmailAddressVerification (resend)', err);
      toast({
        title: 'Алдаа',
        description: msg ?? 'Код илгээхэд алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
        variant: 'destructive',
      });
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
      const signInPayload = {
        phoneNumber: phoneNumber.trim(),
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

      if (response.data && response.data.success) {
        setToken(response.data.token);
        setUser({
          ...response.data.user,
          id: response.data.user.id || response.data.user._id,
        });

        // Show success screen
        setSuccessMessage(`Сайн байна уу, ${response.data.user.name || 'Хэрэглэгч'}! Нэвтрэх амжилттай.`);
        setShowSuccess(true);
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

  // ========== RENDER: Success Screen ==========
  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={mobileDialogClassName}>
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
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className={mobileDialogClassName}>
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={mobileDialogClassName}>
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
