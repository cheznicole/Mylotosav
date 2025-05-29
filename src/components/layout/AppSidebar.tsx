
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import { Ticket, Settings, PanelLeft, CalendarDays, Clock, Shield, LogOut } from 'lucide-react'; // Added LogOut
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DRAW_SCHEDULE } from '@/services/lotteryApi';
import { slugify } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext'; // Added useAuth
import { useToast } from '@/hooks/use-toast'; // Added useToast

const orderedDays = Object.keys(DRAW_SCHEDULE);

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter(); // Added router
  const { open, setOpen, isMobile, setOpenMobile } = useSidebar();
  const { currentUser, logout } = useAuth(); // Added useAuth
  const { toast } = useToast(); // Added useToast

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
      if (isMobile) {
        setOpenMobile(false);
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({ variant: 'destructive', title: 'Logout Failed', description: 'Could not log out.' });
    }
  };

  const currentDrawSlug = pathname.startsWith('/draw/') ? pathname.split('/')[2] : null;

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <Ticket className="w-8 h-8 text-primary" />
          <h1
            className={cn(
              "font-semibold text-xl text-primary transition-opacity duration-200",
              !open && !isMobile && "opacity-0 w-0 pointer-events-none"
            )}
          >
            Mylotosav
          </h1>
        </Link>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="p-2">
        <Accordion type="multiple" className="w-full" defaultValue={orderedDays}>
          {orderedDays.map((day) => (
            <AccordionItem value={day} key={day}>
              <AccordionTrigger className={cn(
                "hover:no-underline text-sm font-medium px-2 py-2 rounded-md hover:bg-sidebar-accent",
                !open && !isMobile && "justify-center"
              )}>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  <span className={cn(!open && !isMobile && "sr-only")}>{day}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0">
                <SidebarMenu className="pl-4 border-l border-sidebar-border ml-[9px]">
                  {Object.entries(DRAW_SCHEDULE[day]).map(([time, drawName]) => {
                    const drawSlug = slugify(drawName);
                    const href = `/draw/${drawSlug}`;
                    return (
                      <SidebarMenuItem key={drawName}>
                        <Link href={href} passHref legacyBehavior>
                          <SidebarMenuButton
                            asChild
                            size="sm"
                            isActive={currentDrawSlug === drawSlug}
                            tooltip={{ children: `${drawName} (${time})`, className: "bg-card text-card-foreground border-border" }}
                            onClick={handleLinkClick}
                            className="justify-start"
                          >
                            <a>
                              <Clock className="w-3 h-3 mr-1 opacity-70" />
                              <span className={cn("text-xs", !open && !isMobile && "sr-only")}>{drawName} - {time}</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SidebarContent>
      <Separator />
      <SidebarFooter className="p-2 mt-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/admin" passHref legacyBehavior>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/admin'}
                tooltip={{ children: "Admin Panel", className: "bg-card text-card-foreground border-border" }}
                onClick={handleLinkClick}
                className="justify-start"
              >
                <a>
                  <Shield className="w-5 h-5" />
                  <span className={cn(!open && !isMobile && "sr-only")}>Admin</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/settings" passHref legacyBehavior>
              <SidebarMenuButton
                asChild
                isActive={pathname === '/settings'}
                tooltip={{ children: "Settings", className: "bg-card text-card-foreground border-border" }}
                onClick={handleLinkClick}
                className="justify-start"
              >
                <a>
                  <Settings className="w-5 h-5" />
                  <span className={cn(!open && !isMobile && "sr-only")}>Settings</span>
                </a>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          {currentUser && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                tooltip={{ children: "Logout", className: "bg-card text-card-foreground border-border" }}
                className="justify-start w-full"
              >
                <LogOut className="w-5 h-5" />
                <span className={cn(!open && !isMobile && "sr-only")}>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
        {!isMobile && open && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="mt-2 self-end"
          >
            <PanelLeft className="w-5 h-5" />
            <span className="sr-only">Collapse sidebar</span>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;
