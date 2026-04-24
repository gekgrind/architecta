import { redirect } from "next/navigation";

import { APP_HOME_PATH } from "@/lib/auth/redirects";
import { requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

const TOTAL_STEPS = 11;

function getStepIndex(step: string | null) {
  switch (step) {
    case "welcome":
      return 1;
    case "source":
      return 2;
    case "website":
      return 3;
    case "snapshot":
      return 4;
    case "market":
      return 5;
    case "customers":
      return 6;
    case "foundation":
      return 7;
    case "voice":
      return 8;
    case "visuals":
      return 9;
    case "review":
      return 10;
    case "finish":
      return 11;
    default:
      return 1;
  }
}

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthenticatedUser("/onboarding");

  const { session } = await getOrCreateArchitectaOnboarding();

  if (session.status === "completed") {
    redirect(APP_HOME_PATH);
  }

  const currentStep = getStepIndex(session.current_step ?? "welcome");
  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <div className="w-full h-1 bg-slate-800">
        <div
          className="h-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {children}
        </div>
      </main>
    </div>
  );
}
