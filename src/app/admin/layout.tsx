
"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AdminLayoutProps {
  children: ReactNode;
}

// General stability: Minor modification to ensure this layout is re-evaluated.
export default function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser, loading } = useAuth(); // isAdmin check is removed for general access
  const router = useRouter();
  const [localRedirecting, setLocalRedirecting] = useState(false);
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setShowSlowLoadingMessage(true);
      }, 7000); 
    } else {
      setShowSlowLoadingMessage(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      console.log('[AdminLayout] Auth State Resolved (General Access):', {
        currentUser: !!currentUser,
        localRedirecting,
      });
    }

    if (loading || localRedirecting) { 
      return;
    }

    if (!currentUser) {
      console.log('[AdminLayout] No current user. Redirecting to login (unauthenticated).');
      setLocalRedirecting(true);
      router.replace('/login?message=unauthenticated');
    } else {
      // User is authenticated. Access granted (no admin check needed here for layout access).
      console.log('[AdminLayout] User is authenticated. Access granted to admin section.');
    }

  }, [currentUser, loading, router, localRedirecting]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
        <p className="text-xl text-muted-foreground mb-4">Vérification de l'authentification...</p>
        <Skeleton className="h-10 w-3/4 md:w-1/2 mb-4" />
        <Skeleton className="h-8 w-1/2 md:w-1/3 mb-6" />
        
        {showSlowLoadingMessage && (
            <Alert variant="default" className="max-w-lg mt-6 text-left bg-card border-border">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <AlertTitle className="font-semibold text-primary">Chargement Prolongé</AlertTitle>
                <AlertDescription className="text-sm text-card-foreground">
                    La vérification prend plus de temps que prévu. Veuillez vérifier :
                    <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Votre connexion internet.</li>
                        <li>La console de votre navigateur (F12) pour des erreurs Firebase ou réseau.</li>
                    </ul>
                    Si le problème persiste, contactez le support technique ou vérifiez l'état des services Firebase.
                </AlertDescription>
            </Alert>
        )}
      </div>
    );
  }

  if (!currentUser && !loading) { 
    return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <p className="text-xl text-muted-foreground">
              {localRedirecting ? "Redirection en cours..." : "Accès non autorisé. Préparation de la redirection..."}
            </p>
             <p className="text-sm text-muted-foreground mt-2">
                Vous allez être redirigé vers la page de connexion.
             </p>
            <Skeleton className="h-10 w-3/4 md:w-1/2 mt-6" />
        </div>
    );
  }

  // If loading is false, and currentUser is true, grant access.
  return <>{children}</>;
}

