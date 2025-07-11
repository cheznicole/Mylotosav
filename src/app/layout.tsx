
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Toaster } from '@/components/ui/toaster';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { AuthProvider } from '@/components/providers/AuthProvider'; 

// General stability: Minor modification to ensure this layout is re-evaluated.
export const metadata: Metadata = {
  title: 'Mylotosav',
  description: 'Analyse avancée des résultats de loterie et prédictions intelligentes.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${GeistSans.variable} antialiased`}>
        <AuthProvider> 
          <SidebarProvider defaultOpen={true}>
            <AppSidebar />
            <SidebarInset className="flex flex-col min-h-screen">
              <header className="sticky top-0 z-10 flex items-center h-14 px-4 border-b bg-background/80 backdrop-blur-sm md:hidden">
                <SidebarTrigger />
                <h1 className="ml-4 text-lg font-semibold text-primary">Mylotosav</h1>
              </header>
              <main className="flex-1 p-4 md:p-6 lg:p-8">
                {children}
              </main>
              <Toaster />
            </SidebarInset>
          </SidebarProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

