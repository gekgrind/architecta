"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function usePlan() {
  const supabase = createSupabaseBrowserClient();
  const [plan, setPlan] = useState<"free" | "pro">("free");

  useEffect(() => {
    async function loadPlan() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", userData.user.id)
        .single();

      if (data?.plan === "pro") setPlan("pro");
    }

    loadPlan();
  }, [supabase]);

  return plan;
}
