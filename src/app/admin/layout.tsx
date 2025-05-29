
"use client";

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

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
      }
    }
  }, [currentUser, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-lg text-muted-foreground mb-4">Vérification de l'authentification...</p>
        <Skeleton className="h-12 w-1/2 mb-4" />
        <Skeleton className="h-8 w-1/4 mb-6" />
        <div className="w-full max-w-4xl space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
        <p className="text-sm text-muted-foreground mt-4">Si cela prend du temps, veuillez vérifier votre connexion internet et vous assurer que les revendications d'administrateur (custom claims) sont correctement configurées dans Firebase.</p>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    // This fallback UI is shown while useEffect is processing the redirect.
    return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <p className="text-lg text-muted-foreground">Redirection en cours...</p>
            <Skeleton className="h-12 w-1/2 mt-4" />
        </div>
    );
  }

  return <>{children}</>;
}
