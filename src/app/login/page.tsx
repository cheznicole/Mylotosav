
"use client";

import { useState, useEffect } from 'react'; // Added useEffect
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';

// LoginPage component for user authentication
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'unauthenticated') {
      toast({
        variant: 'destructive',
        title: 'Authentification Requise',
        description: "Vous devez être connecté pour accéder au panneau d'administration.",
        duration: 7000,
      });
    } else if (message === 'unauthorized') {
      toast({
        variant: 'destructive',
        title: 'Accès Refusé',
        description: "Vous n'avez pas les privilèges administratifs pour accéder au panneau d'administration.",
        duration: 7000,
      });
    }
    // It's generally okay to leave the query param in the URL for transparency,
    // or you could router.replace('/login') to clear it, but that might cause a flicker.
  }, [searchParams, toast]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      toast({ title: 'Connexion Réussie', description: "Redirection vers l'admin..." });
      router.push('/admin');
    } catch (error) {
      // Error toast is handled by AuthProvider's login function
      setIsLoading(false);
    }
    // setIsLoading(false) is handled by success (navigation away) or specific catch block
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Mylotosav Admin</CardTitle>
          <CardDescription>Veuillez vous connecter pour accéder au panneau d'administration.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              {isLoading ? 'Connexion...' : 'Se Connecter'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground text-center w-full">
                Assurez-vous d'avoir les privilèges d'administrateur.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
