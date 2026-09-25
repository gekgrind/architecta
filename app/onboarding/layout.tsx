import { redirect } from "next/navigation";

import { APP_HOME_PATH } from "@/lib/auth/redirects";
import { requireAuthenticatedUser } from "@/lib/auth/requireAuthenticatedUser";
import { getOrCreateArchitectaOnboarding } from "@/lib/onboarding/server";

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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:py-12">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </main>
    </div>
  );
}
