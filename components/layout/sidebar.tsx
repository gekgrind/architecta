"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Library,
  Target,
  Palette,
  BarChart3,
  Search,
  CalendarDays,
  ChevronDown,
  Settings,
  LogOut,
  Building2,
  Menu,
} from "lucide-react";

import { useAuthIdentity } from "@/hooks/use-auth-identity";
import { buildSharedLoginHref } from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/library", label: "Library", icon: Library },
  { href: "/campaigns", label: "Campaigns", icon: Target },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
  { href: "/seo", label: "SEO Tools", icon: Search },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { avatarUrl, displayName, workspaceName } = useAuthIdentity();

  async function handleLogout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Redirect through shared auth even if local session cleanup is unavailable.
    }

    window.location.assign(buildSharedLoginHref());
  }

  const renderNav = (mode: "desktop" | "mobile") => (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Primary">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} title={item.label} aria-label={item.label}>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 overflow-hidden font-medium transition-all duration-200 motion-reduce:transition-none",
                mode === "desktop" && "lg:justify-center lg:px-0 lg:group-hover/sidebar:justify-start lg:group-hover/sidebar:px-4 lg:group-focus-within/sidebar:justify-start lg:group-focus-within/sidebar:px-4",
                isActive
                  ? "bg-sidebar-accent text-secondary border-l-2 border-secondary rounded-l-none"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  "truncate",
                  mode === "desktop" &&
                    "lg:w-0 lg:opacity-0 lg:transition-[width,opacity] lg:duration-200 lg:motion-reduce:transition-none lg:group-hover/sidebar:w-36 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-36 lg:group-focus-within/sidebar:opacity-100"
                )}
              >
                {item.label}
              </span>
            </Button>
          </Link>
        );
      })}
    </nav>
  );

  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-center gap-3 overflow-hidden px-2 transition-all duration-200 motion-reduce:transition-none lg:group-hover/sidebar:justify-start lg:group-focus-within/sidebar:justify-start"
          aria-label="Open account menu"
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {displayName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col items-start overflow-hidden text-left lg:w-0 lg:opacity-0 lg:transition-[width,opacity] lg:duration-200 lg:motion-reduce:transition-none lg:group-hover/sidebar:w-36 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-36 lg:group-focus-within/sidebar:opacity-100">
            <span className="max-w-full truncate text-sm font-medium text-sidebar-foreground">
              {displayName}
            </span>
            <span className="max-w-full truncate text-xs text-muted-foreground">
              {workspaceName ?? "Entrepreneuria"}
            </span>
          </div>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block lg:w-0 lg:opacity-0 lg:transition-[width,opacity] lg:duration-200 lg:motion-reduce:transition-none lg:group-hover/sidebar:w-4 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:w-4 lg:group-focus-within/sidebar:opacity-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Building2 className="mr-2 h-4 w-4" />
            Switch Workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600" onClick={() => void handleLogout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-4 top-4 z-50 border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col pt-2">
            <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground">AI Studio</span>
            </div>
            {renderNav("mobile")}
            <div className="border-t border-sidebar-border p-3">{accountMenu}</div>
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          "group/sidebar fixed left-0 top-0 z-40 hidden h-screen w-20 overflow-visible border-r border-sidebar-border bg-sidebar transition-[width,box-shadow] duration-200 motion-reduce:transition-none",
          "hover:w-60 focus-within:w-60 lg:flex",
          className
        )}
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          <div className="flex h-16 items-center justify-center gap-2 border-b border-sidebar-border px-3 transition-all duration-200 motion-reduce:transition-none group-hover/sidebar:justify-start group-hover/sidebar:px-6 group-focus-within/sidebar:justify-start group-focus-within/sidebar:px-6">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="w-0 overflow-hidden whitespace-nowrap text-lg font-semibold text-sidebar-foreground opacity-0 transition-[width,opacity] duration-200 motion-reduce:transition-none group-hover/sidebar:w-36 group-hover/sidebar:opacity-100 group-focus-within/sidebar:w-36 group-focus-within/sidebar:opacity-100">
              AI Studio
            </span>
          </div>

          {renderNav("desktop")}

          <div className="border-t border-sidebar-border p-3">{accountMenu}</div>
        </div>
      </aside>
    </>
  );
}
