"use client";

import Link from "next/link";

import { useAuthIdentity } from "@/hooks/use-auth-identity";
import { submitLogout } from "@/lib/auth/logout-client";
import {
  buildSharedLoginHref,
  buildSharedSignupHref,
} from "@/lib/auth/redirects";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AuthNav() {
  const { loading, isAuthenticated, displayName, avatarUrl } = useAuthIdentity();

  function handleLogout() {
    /* The route revokes and expires every copy of the session, in every
       scope, then sends the visitor to shared auth. */
    submitLogout();
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

      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Log out of all devices
      </Button>
    </div>
  );
}
