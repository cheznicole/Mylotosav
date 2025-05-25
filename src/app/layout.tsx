import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Toaster } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';


const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Loto Bonheur Predict',
  description: 'AI-Powered Lottery Prediction Tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SidebarProvider defaultOpen={true}>
          <AppSidebar />
          <SidebarInset className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-10 flex items-center h-14 px-4 border-b bg-background/80 backdrop-blur-sm md:hidden">
              <SidebarTrigger />
              <h1 className="ml-4 text-lg font-semibold text-primary">Loto Bonheur Predict</h1>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
              {children}
            </main>
            <Toaster />
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
