import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  LOGOUT_PATH,
  buildSharedLoginHref,
  sanitizePostAuthRedirectPath,
  type SessionRecoveryReason,
} from "@/lib/auth/redirects";

/*
 * Sign-out confirmation and session recovery. Sign-out itself only
 * happens when the visitor submits the form below (a same-origin POST);
 * nothing on this page changes a session by being loaded.
 */

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const ALL_DEVICES =
  "Signing out ends your Entrepreneuria session on every device you're signed in on, including this one.";

const COPY: Record<
  SessionRecoveryReason | "confirm",
  { kicker: string; title: string; body: string }
> = {
  confirm: {
    kicker: "Sign out",
    title: "Sign out of all devices?",
    body: ALL_DEVICES,
  },
  "session-conflict": {
    kicker: "Session check",
    title: "More than one account is signed in on this browser.",
    body: `Architecta can't tell which account to use, so it hasn't chosen one. Sign out, then sign in with the account you want. ${ALL_DEVICES}`,
  },
  "session-unresolved": {
    kicker: "Session check",
    title: "We couldn't safely restore your session.",
    body: `This browser holds more than one saved sign-in and Architecta can't confirm which one is current without risking the others, so none has been changed. Sign out, then sign in again. ${ALL_DEVICES}`,
  },
  "auth-unavailable": {
    kicker: "Session check",
    title: "We couldn't check your session right now.",
    body: "The sign-in service didn't respond, so nothing about your session has been changed. Try again in a moment.",
  },
};

/* A sign-out that was not confirmed everywhere: what this browser knows. */
const UNCONFIRMED = {
  incomplete: {
    title: "You're signed out on this browser.",
    body: "We couldn't confirm that your sessions on other devices were ended. To make sure they are, sign in again and then sign out — that ends every session for your account.",
  },
  local: {
    title: "You're signed out on this browser.",
    body: "This browser didn't hold a session that still worked, so we couldn't end your sessions on other devices from here. If you're signed in anywhere else, sign in again and then sign out to end them all.",
  },
};

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignOutConfirmPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const reasonParam = single(params.reason);
  const reason =
    reasonParam && reasonParam in COPY && reasonParam !== "confirm"
      ? (reasonParam as SessionRecoveryReason)
      : null;
  const nextParam = single(params.next);
  const retryPath = nextParam ? sanitizePostAuthRedirectPath(nextParam) : null;

  const statusParam = single(params.status);

  if (statusParam === "incomplete" || statusParam === "local") {
    const copy = UNCONFIRMED[statusParam];

    return (
      <main className="w-full max-w-xl px-6 py-24">
        <div className="flex flex-col items-start gap-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Signed out</p>
            <h1 className="text-3xl font-semibold text-foreground">
              {copy.title}
            </h1>
            <p className="text-muted-foreground">{copy.body}</p>
          </div>

          <Button asChild>
            <Link href={buildSharedLoginHref("/dashboard")}>Sign in</Link>
          </Button>
        </div>
      </main>
    );
  }

  const copy = COPY[reason ?? "confirm"];

  return (
    <main className="w-full max-w-xl px-6 py-24">
      <div className="flex flex-col items-start gap-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            {copy.kicker}
          </p>
          <h1 className="text-3xl font-semibold text-foreground">{copy.title}</h1>
          <p className="text-muted-foreground">{copy.body}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {reason === "auth-unavailable" && retryPath ? (
            <Button asChild>
              <Link href={retryPath}>Try again</Link>
            </Button>
          ) : null}

          <form method="post" action={LOGOUT_PATH}>
            <Button
              type="submit"
              variant={reason === "auth-unavailable" ? "outline" : "default"}
            >
              Sign out of all devices
            </Button>
          </form>

        </div>
      </div>
    </main>
  );
}
