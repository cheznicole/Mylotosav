
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

  useEffect(() => {
    console.log('[AuthProvider] useEffect triggered');
    let isActive = true; // Flag to prevent state updates if component unmounts
    let loadingTimeout: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[AuthProvider] onAuthStateChanged callback triggered. User:', user ? user.uid : null);
      // Clear previous timeout if auth state changes quickly
      if (loadingTimeout) clearTimeout(loadingTimeout);

      try {
        if (user) {
          setCurrentUser(user);
          console.log('[AuthProvider] User detected. Fetching ID token result...');
          try {
            const idTokenResult = await user.getIdTokenResult(true); // Force refresh
            console.log('[AuthProvider] ID token result fetched. Claims:', idTokenResult.claims);
            if (isActive) {
              setIsAdmin(!!idTokenResult.claims.admin);
              console.log('[AuthProvider] isAdmin set to:', !!idTokenResult.claims.admin);
            }
          } catch (tokenError) {
            console.error("[AuthProvider] Error fetching ID token result:", tokenError);
            toast({ variant: "destructive", title: "Auth Error", description: "Failed to verify admin status. Please check network or re-login." });
            if (isActive) {
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

    // Fallback timeout to prevent indefinite loading if onAuthStateChanged doesn't resolve quickly
    loadingTimeout = setTimeout(() => {
      if (isActive && loading) {
        console.warn('[AuthProvider] Auth state resolution timed out. Forcing loading to false.');
        setLoading(false);
        // Potentially set user to null and isAdmin to false if still loading
        // This indicates a deeper problem with Firebase init or connection
        if (!currentUser) {
          setCurrentUser(null);
          setIsAdmin(false);
        }
      }
    }, 20000); // 20 seconds timeout

    return () => {
      isActive = false;
      unsubscribe();
      if (loadingTimeout) clearTimeout(loadingTimeout);
      console.log('[AuthProvider] Unsubscribed from onAuthStateChanged.');
    };
  }, [toast]); // Added toast

  const login = async (email: string, pass: string) => {
    console.log('[AuthProvider] login called for email:', email);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      console.log('[AuthProvider] signInWithEmailAndPassword successful. onAuthStateChanged will handle the rest.');
      // onAuthStateChanged will handle setting user, admin status, and then setLoading(false)
    } catch (error: any) {
      console.error("[AuthProvider] Login error:", error);
      toast({ variant: "destructive", title: "Login Failed", description: error.message || "Invalid credentials or user not found." });
      if (error.code === 'auth/invalid-credential') {
         // Specific message for invalid credentials
         toast({ variant: "destructive", title: "Identifiants Invalides", description: "L'email ou le mot de passe est incorrect. Veuillez réessayer."});
      }
      setIsAdmin(false);
      setCurrentUser(null);
      setLoading(false); // Explicitly set loading to false on login error
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
      setIsAdmin(false);
      setCurrentUser(null);
      setLoading(false);
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
