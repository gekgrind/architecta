import { redirect } from "next/navigation";

import { buildSharedAuthHref } from "@/lib/auth/redirects";

type AuthRedirectPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({
  searchParams,
}: AuthRedirectPageProps) {
  redirect(buildSharedAuthHref("/login", await searchParams));
}
