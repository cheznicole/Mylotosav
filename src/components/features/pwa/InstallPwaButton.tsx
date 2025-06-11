
"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DownloadCloud } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPwaButton({ className, open }: { className?: string, open?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null); // Clear the saved prompt
      toast({
        title: "Application Installée",
        description: "Mylotosav a été ajoutée à votre écran d'accueil.",
      });
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if running in standalone mode (installed PWA)
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsAppInstalled(true);
    }
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [toast]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      toast({
        variant: "default",
        title: "Installation Non Disponible",
        description: "L'installation n'est pas disponible pour le moment ou l'application est déjà installée.",
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      // User accepted the A2HS prompt - no need to toast here, appinstalled event will handle it
    } else {
      toast({
        title: "Installation Annulée",
        description: "Vous pourrez toujours installer l'application plus tard.",
      });
    }
    setDeferredPrompt(null); // We can only use the prompt once.
  }, [deferredPrompt, toast]);

  if (!deferredPrompt || isAppInstalled) {
    return null; // Don't show the button if it's not available or already installed
  }

  return (
    <Button
      onClick={handleInstallClick}
      variant="ghost"
      className={cn(
        "justify-start w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        className
      )}
    >
      <DownloadCloud className="w-5 h-5" />
      <span className={cn("ml-2", !open && "sr-only")}>Installer l'App</span>
    </Button>
  );
}
