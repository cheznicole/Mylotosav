"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Newspaper, Network, BarChart3, Cpu, Ticket, Settings, PanelLeft } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/predict', label: 'Predict', icon: Cpu },
  { href: '/results', label: 'Results', icon: Newspaper },
  { href: '/statistics', label: 'Statistics', icon: BarChart3 },
  { href: '/co-occurrence', label: 'Co-occurrence', icon: Network },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { open, setOpen, isMobile, setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

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
            Loto Predict
          </h1>
        </Link>
      </SidebarHeader>
      <Separator />
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <Link href={item.href} passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label, className: "bg-card text-card-foreground border-border" }}
                  onClick={handleLinkClick}
                  className="justify-start"
                >
                  <a>
                    <item.icon className="w-5 h-5" />
                    <span className={cn(!open && !isMobile && "sr-only")}>{item.label}</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator />
      <SidebarFooter className="p-2 mt-auto">
        <SidebarMenu>
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
