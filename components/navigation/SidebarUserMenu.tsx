"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Settings, UserCircle } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveSidebarUserIdentity } from "@/lib/navigation/sidebar-model";
import type { SidebarUser } from "@/lib/navigation/types";
import { cn } from "@/lib/utils";

type SidebarUserMenuProps = {
  user?: SidebarUser | null;
  isExpanded: boolean;
};

type MenuPosition = {
  left: number;
  top: number;
};

export function SidebarUserMenu({ user, isExpanded }: SidebarUserMenuProps) {
  const identity = resolveSidebarUserIdentity(user);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setMenuPosition(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function updatePosition() {
      const trigger = containerRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 208;
      const menuHeight = 156;
      const viewportPadding = 16;
      const left = Math.min(
        Math.max(rect.right + 12, viewportPadding),
        window.innerWidth - menuWidth - viewportPadding
      );
      const top = Math.min(
        Math.max(rect.bottom - menuHeight, viewportPadding),
        window.innerHeight - menuHeight - viewportPadding
      );

      setMenuPosition({ left, top });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    updatePosition();
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  return (
    <div className="border-t border-white/10 px-4 pt-4">
      <div ref={containerRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls={isOpen ? "sidebar-account-menu" : undefined}
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            "group flex w-full items-center rounded-2xl border border-[#00D4FF]/20 bg-[#0B2B57]/60 text-left shadow-[0_10px_30px_-18px_rgba(0,212,255,0.45)] transition-all hover:border-[#00D4FF]/45 hover:bg-[#0B2B57]/80",
            isExpanded ? "gap-3 p-3" : "justify-center p-2"
          )}
        >
          <Avatar className="h-10 w-10 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/10 p-0.5">
            <AvatarImage src={identity.avatarUrl} alt={identity.name} />
            <AvatarFallback className="rounded-lg bg-[#041C3B] text-sm font-bold text-white">
              {identity.initials}
            </AvatarFallback>
          </Avatar>
          {isExpanded ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white group-hover:text-[#00D4FF]">
                {identity.name}
              </span>
              <span className="block truncate text-[11px] text-[#BCC0D8]">
                {identity.title}
              </span>
            </span>
          ) : null}
        </button>
      </div>

      {isOpen && menuPosition ? (
        <div
          ref={menuRef}
          id="sidebar-account-menu"
          role="menu"
          className="fixed z-[90] w-52 overflow-hidden rounded-xl border border-[#00D4FF]/20 bg-[#041C3B]/95 p-1.5 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={closeMenu}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#BCC0D8] transition-colors hover:bg-white/5 hover:text-white"
          >
            <UserCircle className="h-4 w-4" aria-hidden="true" />
            Account
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={closeMenu}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[#BCC0D8] transition-colors hover:bg-white/5 hover:text-white"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Settings
          </Link>
          <div className="my-1 h-px bg-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              window.location.href = "/auth/logout";
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[#BCC0D8] transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}
