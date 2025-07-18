
"use client";

import { Suspense, useState, useEffect } from 'react'; // Added Suspense
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn } from 'lucide-react';

// This component will handle logic dependent on useSearchParams
function LoginMessages() {
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const message = searchParams.get('message');
    if (message === 'unauthenticated') {
      toast({
        variant: 'destructive',
        title: 'Authentification Requise',
        description: "Vous devez être connecté pour accéder à cette page.",
        duration: 7000,
      });
    }
    // Removed 'unauthorized' message handling as AdminLayout no longer differentiates based on admin role for access.
  }, [searchParams, toast]);

  return null; // This component doesn't render anything itself, it's for side-effects (toasts)
}

// LoginPage component for user authentication
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  // Toast for searchParams messages has been moved to the LoginMessages component.
  // If LoginPage needs to display other toasts directly (e.g., for login success before redirect),
  // const { toast } = useToast(); can be re-added here.

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      // Successful login will navigate. Toasts for success can be added here if desired
      // or handled by AuthProvider or navigation events.
      // e.g., toast({ title: 'Connexion Réussie', description: "Redirection en cours..." });
      router.push('/admin');
    } catch (error) {
      // Error toast is handled by AuthProvider's login function for auth/invalid-credential
      // or other specific errors.
      setIsLoading(false); // Ensure loading is reset on any caught error
    }
    // setLoading(false) is handled in catch or if navigation occurs.
  };

  // Fallback for Suspense. Can be null or a visually hidden loading indicator
  // if the suspended component doesn't render UI itself.
  const SuspenseFallback = () => <div className="sr-only">Loading page messages...</div>;

  return (
    <>
      <Suspense fallback={<SuspenseFallback />}>
        <LoginMessages />
      </Suspense>
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-primary">Mylotosav</CardTitle>
            <CardDescription>Veuillez vous connecter pour accéder à l'application.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="utilisateur@example.com"
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
                  Connectez-vous pour gérer les données de loterie.
              </p>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
