# Architecta Auth Hardening Notes

## Active auth/session paths audited

Active source tree searched: `app/**`, `components/**`, `lib/**`

Patterns checked:

- `auth.getUser()`
- `signInWithPassword`
- `signUp`
- `resetPasswordForEmail`
- `updateUser`
- `Turnstile`
- `captcha`
- `/auth/login`
- `/auth/signup`
- `/auth/callback`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_ARCHITECTA_APP_URL`
- `NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN`

## Required shared auth environment

- `NEXT_PUBLIC_APP_URL=https://entrepreneuria.io`
- `NEXT_PUBLIC_ARCHITECTA_APP_URL=https://architecta.entrepreneuria.io`
- `NEXT_PUBLIC_ENTREPRENEURIA_COOKIE_DOMAIN=.entrepreneuria.io`

## Active auth paths that remain

- Shared-auth compatibility entry routes:
  - `app/auth/login/page.tsx`
  - `app/auth/signup/page.tsx`
  - `app/auth/check-email/page.tsx`
  - `app/auth/callback/route.ts`
- Shared redirect helpers:
  - `lib/auth/redirects.ts`
  - `lib/config/ecosystem.ts`
- Server auth/session helpers:
  - `lib/supabase/cookies.ts`
  - `lib/supabase/server.ts`
  - `lib/auth/server.ts`
  - `lib/auth/requireAuthenticatedUser.ts`
- Shared client identity:
  - `hooks/use-auth-identity.ts`
- Route protection:
  - `middleware.ts`

## What was hardened in this pass

- Added `lib/auth/requireAuthenticatedUser.ts` to standardize server-side auth gating for page/layout usage.
- Updated `app/onboarding/layout.tsx` to use the shared server auth helper instead of an inline `auth.getUser()` check.
- Hardened `app/auth/callback/route.ts` so it:
  - sanitizes `next`,
  - redirects authenticated users to a safe post-auth destination,
  - redirects unauthenticated users back into shared login,
  - falls back safely to `/` if the generated shared login target would loop back to the current Architecta host.
- Hardened shared auth URL generation in `lib/auth/redirects.ts` so missing or self-referential `NEXT_PUBLIC_APP_URL` values fail closed to `/` instead of creating a bad auth redirect target.
- Updated shared login `next` handling so protected Architecta routes send a full safe Architecta return URL, preserving query strings while rejecting off-domain return targets.
- Centralized Supabase SSR cookie options so middleware, server helpers, and browser helpers all use `entrepreneuria-auth-token` with the shared Entrepreneuria cookie attributes.
- Removed the redundant client-side dashboard auth redirect from `app/dashboard/page.tsx`; middleware remains the route protection owner for `/dashboard`.
- Replaced low-risk direct client `auth.getUser()` usage in `components/blueprint/BlueprintCanvas.tsx` and `lib/auth/usePlan.ts` with the shared identity hook.

## Active direct auth usage that still remains intentionally

- Server/API/server-action authorization checks still use `auth.getUser()` where they are acting as request-time authorization boundaries.
- `app/auth/callback/route.ts` still uses `auth.getUser()` intentionally because it needs compatibility-specific callback behavior rather than the redirecting server helper.
- `hooks/use-auth-identity.ts` remains the single active client-side identity poll/subscription point.

## Archived auth exclusion

- TypeScript excludes `_archived` in `tsconfig.json`.
- ESLint ignores `_archived/**` in `eslint.config.mjs`.

## Manual verification steps

1. Visit a protected Architecta route while signed out and verify redirect goes to the shared Entrepreneuria login flow.
   Expected shape: `https://entrepreneuria.io/login?next=https%3A%2F%2Farchitecta.entrepreneuria.io%2F...`
2. Complete shared login and verify return to:
   - `/dashboard` when onboarding is complete
   - `/onboarding` when onboarding is incomplete
3. Hit `/auth/callback?next=/dashboard` with:
   - an active shared session and verify safe local redirect
   - no session and verify redirect to shared login
4. Temporarily unset or misconfigure `NEXT_PUBLIC_APP_URL` in a local environment and verify callback/login redirects fail safely to `/` instead of looping.
5. Use account logout from header/sidebar/nav and verify the shared session is cleared and the user lands on shared login.

## Current remaining risk

- Architecta still depends on the shared auth host and cookie domain being configured correctly in environment.
- Some server actions/routes still perform their own `auth.getUser()` checks, which is expected for authorization but means session checks are not fully centralized.
