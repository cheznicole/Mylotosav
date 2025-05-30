
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

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { currentUser, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const [localRedirecting, setLocalRedirecting] = useState(false);
  const [showSlowLoadingMessage, setShowSlowLoadingMessage] = useState(false);
  const [showNotAdminMessage, setShowNotAdminMessage] = useState(false); // New state

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setShowSlowLoadingMessage(true);
      }, 7000); // Show message after 7 seconds of loading
    } else {
      setShowSlowLoadingMessage(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading) {
      console.log('[AdminLayout] Auth State Resolved:', {
        currentUser: !!currentUser,
        isAdmin,
        localRedirecting,
      });
    }

    if (loading || localRedirecting || showNotAdminMessage) { // Prevent re-entry if already redirecting or showing message
      return;
    }

    if (!currentUser) {
      console.log('[AdminLayout] No current user. Redirecting to login (unauthenticated).');
      setLocalRedirecting(true);
      router.replace('/login?message=unauthenticated');
    } else if (!isAdmin) {
      console.log('[AdminLayout] User is authenticated but not admin. Displaying message, then logging out and redirecting.');
      setShowNotAdminMessage(true); // Show the specific "Not Admin" message
      // Delay the logout and redirect to allow the message to be seen
      setTimeout(() => {
        setLocalRedirecting(true); // Prevent further checks during this async operation
        logout().finally(() => {
           router.replace('/login?message=unauthorized');
           // setShowNotAdminMessage(false); // Optionally hide message after redirect starts
        });
      }, 4000); // Display message for 4 seconds before redirecting
    } else {
      // User is authenticated and is an admin.
      console.log('[AdminLayout] User is authenticated admin. Access granted.');
      setShowNotAdminMessage(false); // Ensure not admin message is hidden if access is granted
    }

  }, [currentUser, isAdmin, loading, router, localRedirecting, logout, showNotAdminMessage]);


  if (showNotAdminMessage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-background">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-3xl font-bold text-destructive mb-3">Accès Refusé</h1>
        <p className="text-xl text-foreground mb-4">
          Vous êtes bien connecté, mais votre compte ne dispose pas des droits d'administrateur.
        </p>
        <Alert variant="destructive" className="max-w-md text-left">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Privilèges Insuffisants</AlertTitle>
            <AlertDescription>
                Pour accéder au panneau d'administration, votre compte doit avoir la revendication personnalisée (custom claim) <code className="font-mono bg-muted px-1 py-0.5 rounded text-sm">admin:true</code> configurée dans Firebase Authentication.
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                    <li>Veuillez vérifier que cette revendication a été correctement appliquée à votre UID <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">{currentUser?.uid || 'N/A'}</code>.</li>
                    <li>La revendication est sensible à la casse et doit être un booléen <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">true</code>.</li>
                </ul>
            </AlertDescription>
        </Alert>
        <p className="text-md text-muted-foreground mt-6">
          Vous allez être déconnecté et redirigé vers la page de connexion...
        </p>
        <Loader2 className="h-8 w-8 animate-spin text-primary mt-8" />
      </div>
    );
  }

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
                        <li>Que les revendications d'administrateur (custom claims <code className="font-mono bg-muted px-1 py-0.5 rounded text-xs">admin:true</code>) sont correctement configurées pour votre compte.</li>
                        <li>La console de votre navigateur (F12) pour des erreurs Firebase ou réseau.</li>
                    </ul>
                    Si le problème persiste, contactez le support technique ou vérifiez l'état des services Firebase.
                </AlertDescription>
            </Alert>
        )}
      </div>
    );
  }

  if (!currentUser || !isAdmin) { // This will be briefly hit before showNotAdminMessage or redirect kicks in
    return (
         <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <p className="text-xl text-muted-foreground">
              {localRedirecting ? "Redirection en cours..." : "Accès non autorisé ou session expirée. Préparation de la redirection..."}
            </p>
             <p className="text-sm text-muted-foreground mt-2">
                Vous allez être redirigé vers la page de connexion.
             </p>
            <Skeleton className="h-10 w-3/4 md:w-1/2 mt-6" />
        </div>
    );
  }

  // If loading is false, and currentUser and isAdmin are true
  return <>{children}</>;
}
