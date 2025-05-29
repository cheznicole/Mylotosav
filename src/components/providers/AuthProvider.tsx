
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
  const [loading, setLoading] = useState<boolean>(true); // Initial loading state
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (user) {
          try {
            // Attempt to get fresh token result to check claims
            const idTokenResult = await user.getIdTokenResult(true); // Force refresh
            setIsAdmin(!!idTokenResult.claims.admin);
          } catch (error) {
            console.error("Error fetching ID token result:", error);
            setIsAdmin(false); // Ensure isAdmin is false if token check fails
            toast({ variant: "destructive", title: "Auth Error", description: "Failed to verify admin status. Please ensure custom claims are set correctly." });
          }
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        // Catch any unexpected errors during the onAuthStateChanged user processing
        console.error("Critical error in onAuthStateChanged user processing:", e);
        setIsAdmin(false);
        setCurrentUser(null);
      } finally {
        // This ensures setLoading(false) is called regardless of success/failure above
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]); // toast dependency is generally stable

  const login = async (email: string, pass: string) => {
    setLoading(true); // Signal that a login operation has started
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting user, admin status, and then setLoading(false)
    } catch (error: any) {
      console.error("Login error:", error);
      toast({ variant: "destructive", title: "Login Failed", description: error.message || "Invalid credentials or user not found." });
      setIsAdmin(false); // Reset states on login failure
      setCurrentUser(null);
      setLoading(false); // Explicitly set loading to false on login error
      throw error; // Re-throw to allow login page to handle UI updates
    }
  };

  const logout = async () => {
    setLoading(true); // Signal that a logout operation has started
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle resetting user, admin status, and then setLoading(false)
    } catch (error) {
      console.error("Logout error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "Could not log out." });
      // Ensure states are reset and loading is false even if onAuthStateChanged is slow or errors
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
