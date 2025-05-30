
"use client";

import { useState, useEffect, type ReactNode } from 'react';
import { type User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { AuthContext, type AuthContextType } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Add isActive guard for all state setters if operations could complete after unmount
  // This is mostly covered by the useEffect cleanup, but good for direct async calls too.
  let isActive = true;
  useEffect(() => {
    isActive = true; // Set to true when component mounts or dependencies change
    return () => {
      isActive = false; // Set to false when component unmounts or before dependencies change
    };
  }, []);


  useEffect(() => {
    console.log('[AuthProvider] useEffect triggered');
    let loadingTimeout: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthProvider] onAuthStateChanged callback triggered. User:', user ? user.uid : null);
      if (loadingTimeout) clearTimeout(loadingTimeout);

      try {
        if (user) {
          if (isActive) setCurrentUser(user);
          console.log('[AuthProvider] User detected. Fetching ID token result (forcing refresh)...');
          try {
            const idTokenResult = await user.getIdTokenResult(true); // Force refresh token
            console.log('[AuthProvider] ID token result fetched. Claims:', idTokenResult.claims);
            if (isActive) {
              setIsAdmin(!!idTokenResult.claims.admin);
              console.log('[AuthProvider] isAdmin set to:', !!idTokenResult.claims.admin);
            }
          } catch (tokenError: any) {
            console.error("[AuthProvider] Error fetching ID token result:", tokenError);
            if (isActive) {
              toast({
                variant: "destructive",
                title: "Erreur d'Authentification",
                description: `Impossible de vérifier le statut administrateur: ${tokenError.message || "Veuillez vérifier votre connexion ou vous reconnecter."}`
              });
              setIsAdmin(false);
            }
          }
        } else {
          if (isActive) {
            setCurrentUser(null);
            setIsAdmin(false);
            console.log('[AuthProvider] No user detected. isAdmin set to false.');
          }
        }
      } catch (e) {
        console.error("[AuthProvider] Critical error in onAuthStateChanged user processing:", e);
        if (isActive) {
          setIsAdmin(false);
          setCurrentUser(null);
        }
      } finally {
        if (isActive) {
          setLoading(false);
          console.log('[AuthProvider] Loading state set to false.');
        }
      }
    });

    // Safeguard timeout for initial loading
    loadingTimeout = setTimeout(() => {
      if (isActive && loading) { // Check loading state as well
        console.warn('[AuthProvider] Auth state resolution timed out. Forcing loading to false.');
        setLoading(false); // Ensure loading is set to false
        if (!currentUser && isActive) { 
          setCurrentUser(null);
          setIsAdmin(false);
        }
      }
    }, 20000); // 20 seconds timeout

    return () => {
      if (isActive) { // Only try to cleanup if it was active
         isActive = false; // Set to false on cleanup
      }
      unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
      console.log('[AuthProvider] Unsubscribed from onAuthStateChanged.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); // currentUser should not be in deps, causes loops

  const login = async (email: string, pass: string) => {
    console.log('[AuthProvider] login called for email:', email);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      console.log('[AuthProvider] signInWithEmailAndPassword successful. onAuthStateChanged will handle the rest.');
      // onAuthStateChanged will handle setting user, admin status, and then setLoading(false)
    } catch (error: any) {
      console.error("[AuthProvider] Login error:", error);
      if (error.code === 'auth/invalid-credential') {
         console.error("[AuthProvider] Specific error: auth/invalid-credential. This means Firebase rejected the email/password. Please verify credentials and user account status in Firebase console.");
         toast({ variant: "destructive", title: "Identifiants Invalides", description: "L'email ou le mot de passe est incorrect. Veuillez réessayer."});
      } else {
        toast({ variant: "destructive", title: "Login Failed", description: error.message || "An unknown error occurred during login." });
      }
      if (isActive) { 
        setIsAdmin(false);
        setCurrentUser(null);
        setLoading(false); 
      }
      throw error; 
    }
  };

  const logout = async () => {
    console.log('[AuthProvider] logout called.');
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      console.log('[AuthProvider] firebaseSignOut successful. onAuthStateChanged will handle reset.');
      // onAuthStateChanged will handle resetting user, admin status, and then setLoading(false)
    } catch (error) {
      console.error("[AuthProvider] Logout error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "Could not log out." });
      if (isActive) { 
        // Reset states on logout error as well, though onAuthStateChanged should handle it if signout eventually succeeds
        setIsAdmin(false);
        setCurrentUser(null);
        setLoading(false);
      }
    }
  };
  
  const value: AuthContextType = {
    currentUser,
    isAdmin,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
