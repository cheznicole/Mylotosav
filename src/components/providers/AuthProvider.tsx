
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          setIsAdmin(!!idTokenResult.claims.admin);
        } catch (error) {
          console.error("Error fetching ID token result:", error);
          setIsAdmin(false);
          toast({ variant: "destructive", title: "Auth Error", description: "Failed to verify admin status." });
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting user and admin status
    } catch (error: any) {
      console.error("Login error:", error);
      toast({ variant: "destructive", title: "Login Failed", description: error.message || "Invalid credentials." });
      setIsAdmin(false); // Ensure admin status is reset on login failure
      setCurrentUser(null); // Ensure user is null on login failure
      setLoading(false); // Explicitly set loading to false on error
      throw error; // Re-throw to allow login page to handle redirect logic if needed
    }
    // setLoading(false) will be handled by onAuthStateChanged's effect
  };

  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle resetting user and admin status
    } catch (error) {
      console.error("Logout error:", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "Could not log out." });
    } finally {
      // Ensure admin status is reset and loading is false even if onAuthStateChanged is slow
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
