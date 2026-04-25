# Architecta Auth Migration

## Archived legacy auth files

- `_archived/auth/app/auth/login/page.tsx`
- `_archived/auth/app/auth/signup/page.tsx`
- `_archived/auth/app/auth/callback/route.ts`
- `_archived/auth/app/auth/check-email/page.tsx`
- `_archived/auth/components/auth/callback/route.ts`
- `_archived/auth/lib/auth/redirect.ts`
- `_archived/auth/lib/auth/oauth.ts`

## Active auth/session files

- `lib/config/ecosystem.ts`
- `lib/auth/redirects.ts`
- `lib/auth/profile.ts`
- `lib/auth/server.ts`
- `lib/auth/entitlements.ts`
- `lib/auth/usePlan.ts`
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/cookies.ts`
- `lib/supabase/service.ts`
- `hooks/use-auth-identity.ts`
- `middleware.ts`
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/check-email/page.tsx`
- `app/auth/callback/route.ts`
- `components/auth/AuthNav.tsx`
- `components/landing/Navbar.tsx`
- `components/layout/header.tsx`
- `components/layout/sidebar.tsx`

## Shared auth assumptions

- Required shared auth env vars:
  - `NEXT_PUBLIC_APP_URL=https://entrepreneuria.io`
  - `NEXT_PUBLIC_ARCHITECTA_APP_URL=https://architecta.entrepreneuria.io`
  - `NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN=.entrepreneuria.io`
- Architecta consumes the shared Entrepreneuria Supabase project and shared cookie domain.
- Supabase SSR server, middleware, and browser clients use the shared cookie name `entrepreneuria-auth-token` with `domain=.entrepreneuria.io`, `path=/`, `sameSite=lax`, and `secure` in production.
- Canonical credential-entry pages live on `NEXT_PUBLIC_APP_URL` at `/login`, `/sign-up`, and `/verify-email`.
- Architecta still reads the authenticated user locally from the shared Supabase session for route protection, profile loading, avatar rendering, onboarding checks, and feature gating.
- No explicit Architecta entitlement table exists in this repo today, so local authorization only blocks access when the shared profile exposes an explicit deny signal such as `architecta_access = false` or an app list that omits `architecta`.
- No active local Turnstile/CAPTCHA component remains in this repo after the migration audit.

## Redirect behavior

- Protected Architecta routes redirect unauthenticated users to the shared login flow with a full Architecta `next` URL, not a marketing-site-relative path.
- Legacy local auth routes remain only as thin compatibility redirects to the shared auth site.
- Legacy callback handling no longer exchanges auth codes locally; it now forwards authenticated users to the correct post-auth destination and unauthenticated users back into the shared login flow.
- Shared logout is handled locally by clearing the shared Supabase session cookie in Architecta, then redirecting users to the shared login route.
