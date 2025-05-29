
"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.replace('/login?message=unauthenticated');
      } else if (!isAdmin) {
        router.replace('/login?message=unauthorized');
        // Optionally, redirect to a specific "Unauthorized" page
        // Or show an unauthorized message here if you don't want to redirect from login
      }
    }
  }, [currentUser, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Skeleton className="h-12 w-1/2 mb-4" />
        <Skeleton className="h-8 w-1/4 mb-6" />
        <div className="w-full max-w-4xl space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    // This case should ideally be handled by the redirect,
    // but as a fallback, show loading or a minimal message.
    // The redirect will happen on the next render cycle of useEffect.
    return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
            <Skeleton className="h-12 w-1/2 mt-4" />
        </div>
    );
  }

  return <>{children}</>;
}
