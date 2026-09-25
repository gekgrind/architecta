import { notFound } from "next/navigation";

/**
 * Development-only guard for the onboarding preview route.
 * This layout runs on the server. Any request arriving in production
 * (NODE_ENV !== "development") immediately returns 404, so neither the
 * page nor any child component is ever rendered or reachable.
 *
 * This layout intentionally does NOT inherit app/onboarding/layout.tsx
 * (which requires auth) because it lives in the (dev) route group.
 */
export default function DevPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <>{children}</>;
}
