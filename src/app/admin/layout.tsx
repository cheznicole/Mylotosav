
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [localRedirecting, setLocalRedirecting] = useState(false);

  useEffect(() => {
    if (!loading) {
      // Log current auth state once loading is complete, for debugging
      console.log('[AdminLayout] Auth State Resolved:', {
        currentUser: !!currentUser,
        isAdmin,
        localRedirecting,
      });
    }

    // If auth state is still loading, or if we've already initiated a redirect, do nothing.
    if (loading || localRedirecting) {
      return;
    }

    // Auth state is resolved (loading is false) and no redirect initiated yet.
    if (!currentUser) {
      setLocalRedirecting(true);
      router.replace('/login?message=unauthenticated');
    } else if (!isAdmin) {
      setLocalRedirecting(true);
      router.replace('/login?message=unauthorized');
    }
    // If currentUser and isAdmin are true, localRedirecting remains false, and component proceeds to render children.

  }, [currentUser, isAdmin, loading, router, localRedirecting]);


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
        <p className="text-sm text-muted-foreground mt-4">
            Si cela prend beaucoup de temps, veuillez vérifier votre connexion internet et vous assurer
            que les revendications d'administrateur (custom claims) sont correctement configurées dans Firebase.
            Vérifiez également la console de votre navigateur pour des erreurs spécifiques.
        </p>
      </div>
    );
  }

  // If loading is false, but conditions for access are not met
  // This state is primarily for the brief moment while router.replace() is taking effect.
  if (!currentUser || !isAdmin) {
    return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <p className="text-lg text-muted-foreground">
              {localRedirecting ? "Redirection vers la page de connexion..." : "Accès non autorisé. Préparation de la redirection..."}
            </p>
            <Skeleton className="h-12 w-1/2 mt-4" />
        </div>
    );
  }

  // If loading is false, and currentUser and isAdmin are true
  return <>{children}</>;
}
