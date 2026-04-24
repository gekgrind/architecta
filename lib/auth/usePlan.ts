"use client";

import { useAuthIdentity } from "@/hooks/use-auth-identity";

export function usePlan() {
  const { profile } = useAuthIdentity();

  return profile?.plan === "pro" ? "pro" : "free";
}
