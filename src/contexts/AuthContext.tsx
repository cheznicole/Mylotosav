
"use client";

import type { User as FirebaseUser } from 'firebase/auth';
import { createContext, useContext, type ReactNode } from 'react';

export interface AuthContextType {
  currentUser: FirebaseUser | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
