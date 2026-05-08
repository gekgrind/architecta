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
  error: string | null;
};

const DEFAULT_STATE: AuthIdentityState = {
  loading: true,
  user: null,
  profile: null,
  error: null,
};

export function useAuthIdentity() {
  const supabase = useMemo(() => {
    try {
      return createSupabaseBrowserClient();
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initialize authentication.",
      };
    }
  }, []);
  const [state, setState] = useState<AuthIdentityState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    async function loadIdentity() {
      if ("error" in supabase) {
        setState({
          loading: false,
          user: null,
          profile: null,
          error: supabase.error,
        });

        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          if (!cancelled) {
            setState({
              loading: false,
              user: null,
              profile: null,
              error: null,
            });
          }

          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!cancelled) {
          setState({
            loading: false,
            user,
            profile: (profile as SharedProfile | null) ?? null,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            user: null,
            profile: null,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load authentication state.",
          });
        }
      }
    }

    void loadIdentity();

    if ("error" in supabase) {
      return () => {
        cancelled = true;
      };
    }

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
