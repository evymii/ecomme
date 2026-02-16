import { ClerkProvider } from '@clerk/nextjs';

export default function ClerkWrapper({ children }: { children: React.ReactNode }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // If Clerk key is not available, render children without ClerkProvider
  if (!clerkKey) {
    return <>{children}</>;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
