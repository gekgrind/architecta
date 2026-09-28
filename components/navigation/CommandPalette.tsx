"use client";

import { CornerDownLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ARCHITECTA_NAV_ITEMS,
  ARCHITECTA_SECONDARY_DESTINATIONS,
} from "@/lib/navigation/architecta-nav";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Keyboard-first navigation across Architecta (Ctrl/⌘ K). It only navigates —
 * it does not pretend to answer questions. A context-aware assistant is staged
 * for a later phase.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Go to"
      description="Jump to an Architecta workspace or tool"
      className="border-white/10 bg-[#041C3B] text-white sm:max-w-xl"
    >
      <CommandInput placeholder="Jump to a workspace or tool…" />
      <CommandList>
        <CommandEmpty>No matching workspace.</CommandEmpty>
        <CommandGroup heading="Workspaces">
          {ARCHITECTA_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.description ?? ""}`}
                onSelect={() => go(item.href)}
                className="gap-3"
              >
                <Icon className="text-[#00D4FF]" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.description ? (
                    <p className="truncate text-xs text-[#BCC0D8]">{item.description}</p>
                  ) : null}
                </div>
                <CornerDownLeft className="!h-3.5 !w-3.5 text-[#BCC0D8]/50" aria-hidden="true" />
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Tools">
          {ARCHITECTA_SECONDARY_DESTINATIONS.map((destination) => (
            <CommandItem
              key={destination.href}
              value={`${destination.label} ${destination.parent} ${destination.description}`}
              onSelect={() => go(destination.href)}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  <span className="text-[#BCC0D8]">{destination.parent} / </span>
                  {destination.label}
                </p>
                <p className="truncate text-xs text-[#BCC0D8]">{destination.description}</p>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
