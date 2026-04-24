import Link from "next/link";

import { buildSharedLoginHref } from "@/lib/auth/redirects";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-24">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Access required
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Your account does not currently have Architecta access.
          </h1>
          <p className="text-muted-foreground">
            Sign in with the correct Entrepreneuria account or return to the
            main workspace to manage your access.
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={buildSharedLoginHref()}>Go to Login</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
