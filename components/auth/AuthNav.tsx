"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type AuthUser = {
  name: string;
  email: string;
  avatarUrl?: string;
};

export function AuthNav() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      const u = data.user;

      setUser({
        name:
          u.user_metadata?.full_name ||
          u.user_metadata?.name ||
          u.email?.split("@")[0] ||
          "User",
        email: u.email ?? "",
        avatarUrl: u.user_metadata?.avatar_url,
      });

      setLoading(false);
    }

    loadUser();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/auth/login");
  }

  if (loading) return null;

  // Logged out
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost">
          <Link href="/auth/login">Sign in</Link>
        </Button>

        <Button asChild>
          <Link href="/auth/signup">Start free</Link>
        </Button>
      </div>
    );
  }

  // Logged in
  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src={user.avatarUrl} />
        <AvatarFallback>
          {user.name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <span className="text-sm font-medium">{user.name}</span>

      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  );
}
