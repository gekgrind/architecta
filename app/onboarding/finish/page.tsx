import { redirect } from "next/navigation";
import { APP_HOME_PATH } from "@/lib/auth/redirects";
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

  redirect(APP_HOME_PATH);
}
