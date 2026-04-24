import { redirect } from "next/navigation";
import FinishStep from "@/components/onboarding/FinishStep";
import {
  getOrCreateArchitectaOnboarding,
  completeArchitectaOnboarding,
} from "@/lib/onboarding/server";

export default async function FinishPage() {
  const { session } = await getOrCreateArchitectaOnboarding();

  // 🚫 Prevent skipping ahead
  if (session.current_step && session.current_step !== "finish") {
    redirect(`/onboarding/${session.current_step}`);
  }

  // ✅ Finalize onboarding (idempotent, server-authoritative)
  if (session.status !== "completed") {
    await completeArchitectaOnboarding();
  }

  return <FinishStep />;
}
