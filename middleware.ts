import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/dashboard", "/studio", "/app"];
const ONBOARDING_PATH = "/onboarding";
const LOGIN_PATH = "/auth/login";
const SIGNUP_PATH = "/auth/signup";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // 🔐 Refresh session if needed
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  const pathname = req.nextUrl.pathname;

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    pathname.startsWith(p)
  );

  const isAuthPage =
    pathname === LOGIN_PATH || pathname === SIGNUP_PATH;

  const isOnboarding =
    pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);

  /* ---------------------------------------------------------
     1️⃣ AUTH GUARD (your existing logic, unchanged)
  --------------------------------------------------------- */

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  /* ---------------------------------------------------------
     2️⃣ ARCHITECTA ONBOARDING GUARD
     - Applies ONLY to authenticated users
     - Applies ONLY to Architecta areas
     - Does NOT run on onboarding routes
  --------------------------------------------------------- */

  const isArchitectaArea =
    pathname.startsWith("/studio") ||
    pathname.startsWith("/app/architecta");

  if (user && isArchitectaArea && !isOnboarding) {
    // Check onboarding status
    const { data: session, error } = await supabase
      .from("onboarding_sessions")
      .select("status")
      .eq("user_id", user.id)
      .eq("app", "architecta")
      .maybeSingle();

    // If no session OR not completed → force onboarding
    if (!session || session.status !== "completed") {
      const url = req.nextUrl.clone();
      url.pathname = ONBOARDING_PATH;
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
      run middleware on all pages except:
      - next static assets
      - images
      - favicon
    */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
