import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Threads data deletion status",
};

type PageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function ThreadsDeletionStatusPage({
  searchParams,
}: PageProps) {
  const { code } = await searchParams;

  return (
    <main className="min-h-screen bg-background px-6 py-24">
      <div className="mx-auto flex max-w-xl flex-col items-start gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Threads data deletion
          </p>
          <h1 className="text-3xl font-semibold text-foreground">
            Your data has been deleted.
          </h1>
          <p className="text-muted-foreground">
            We received your deletion request and removed the Threads connection
            and its stored access tokens from Architecta. Nothing further is
            retained for that account.
          </p>
        </div>

        {code ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">Confirmation code</p>
            <p className="font-mono text-sm text-foreground">{code}</p>
          </div>
        ) : null}

        <Button asChild>
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    </main>
  );
}
