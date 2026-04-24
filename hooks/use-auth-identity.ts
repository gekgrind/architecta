"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getAvatarUrl,
  getDisplayName,
  hasArchitectaAccess,
  type SharedProfile,
} from "@/lib/auth/profile";

type AuthIdentityState = {
  loading: boolean;
  user: User | null;
  profile: SharedProfile | null;
};

const DEFAULT_STATE: AuthIdentityState = {
  loading: true,
  user: null,
  profile: null,
};

export function useAuthIdentity() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [state, setState] = useState<AuthIdentityState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setState({
            loading: false,
            user: null,
            profile: null,
          });
        }

        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setState({
          loading: false,
          user,
          profile: (profile as SharedProfile | null) ?? null,
        });
      }
    }

    void loadIdentity();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadIdentity();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return {
    ...state,
    isAuthenticated: Boolean(state.user),
    displayName: getDisplayName(state.user, state.profile),
    avatarUrl: getAvatarUrl(state.user, state.profile),
    hasArchitectaAccess: hasArchitectaAccess(state.profile),
    workspaceName:
      typeof state.profile?.workspace_name === "string"
        ? state.profile.workspace_name
        : null,
  };
}
