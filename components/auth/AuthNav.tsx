"use client";

import Link from "next/link";

import { useAuthIdentity } from "@/hooks/use-auth-identity";
import {
  buildSharedLoginHref,
  buildSharedSignupHref,
} from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AuthNav() {
  const { loading, isAuthenticated, displayName, avatarUrl } = useAuthIdentity();

  async function handleLogout() {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Redirect through shared auth even if local session cleanup is unavailable.
    }

    window.location.assign(buildSharedLoginHref());
  }

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost">
          <Link href={buildSharedLoginHref()}>Sign in</Link>
        </Button>

        <Button asChild>
          <Link href={buildSharedSignupHref()}>Start free</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatarUrl} />
        <AvatarFallback>
          {displayName.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <span className="text-sm font-medium">{displayName}</span>

      <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
        Log out
      </Button>
    </div>
  );
}
