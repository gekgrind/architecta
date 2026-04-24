# Architecta Refactor Baseline Audit

## What was broken

- Server Supabase helpers were async, but several server routes/utilities consumed them synchronously.
- Some App Router modules violated Next.js 15 conventions:
  - `app/api/llm/route.ts` existed as an empty route module.
  - `app/onboarding/[step]/page.tsx` used synchronous `params`.
  - auth pages using `useSearchParams()` were not wrapped in Suspense.
- Auth pages had type drift around OAuth providers and redirect targets.
- Prompt and LLM modules had missing exports and duplicated type definitions.
- `lib/types.ts`, prompt hints, and mock/demo data disagreed on supported content and brand-kit shapes.
- Several client components had lint-blocking React compiler issues:
  - synchronous state updates in mount/data effects,
  - impure `Math.random()` during render,
  - incomplete hook dependency lists,
  - broad `any` usage in UI and AI helpers.
- Tailwind config used a CommonJS `require()` inside a TypeScript config file.

## What was fixed in this pass

- Awaited `createSupabaseServerClient()` in API and workspace preference code.
- Added a valid lightweight `GET` handler for `/api/llm`.
- Updated `/onboarding/[step]` to the Next.js 15 async `params` contract.
- Wrapped `/auth/login` and `/auth/check-email` search-param content in Suspense boundaries.
- Centralized OAuth provider typing in `lib/auth/oauth.ts` and preserved auth redirect `next` handling.
- Restored prompt-builder type exports in `lib/ai/prompts/types.ts`.
- Added canonical `ModelChoice` to `lib/ai/llm/types.ts` and updated route selection imports.
- Extended shared `BrandKit` and `ContentItem` types to match existing demo/workflow data.
- Completed prompt hints for all canonical `ContentType` variants.
- Replaced lint-blocking `any` usage with narrower structural types in touched modules.
- Deferred mount/data-effect state updates through animation frames where needed for React compiler lint.
- Fixed ReactFlow callback dependencies and node props typing.
- Replaced render-time random skeleton width with a stable width.
- Switched Tailwind plugin loading to an ESM import.

## What remains intentionally deferred

- Existing lint warnings remain, but they do not fail `npm run lint` or `npm run build`:
  - unused imports/parameters in LLM/auth/layout/landing/toast modules,
  - unused `edges` parameters in blueprint conversion helpers.
- Existing encoded text artifacts remain in parts of the app. One landing sentence was normalized only where required by lint.
- Middleware build output still reports Supabase Edge Runtime compatibility warnings from bundled Supabase browser modules. The production build succeeds, but this should be reviewed before deploying middleware-heavy auth behavior.
- No database schema changes were made. Table assumptions for `studio_graphs`, `ai_edit_memory`, `onboarding_sessions`, `profiles`, and workspace LLM preferences were left intact.

## Recommended next refactor targets

- Split AI code into clearer server-only, route-handler, and shared-type modules.
- Consolidate duplicate LLM route surfaces under one supported API path.
- Normalize onboarding state types around one persisted session/profile contract.
- Clean remaining lint warnings so future CI can enforce zero warnings.
- Audit middleware imports and Supabase usage for Edge Runtime compatibility.
- Replace placeholder/default graph state in Studio Canvas with the intended persisted blueprint source.

## Notable schema/type inconsistencies found

- `BrandKit` is used as both a compact generation context and a full brand profile/demo record.
- `ContentItem` is used by library UI as a rich record, while older generation code expects simpler content records.
- Prompt builder platform values (`x_post`, `marketing_email`, `ad_angles`) are separate from canonical content types (`tweet`, `email`, `ad_copy`, etc.).
- Onboarding session flags and brand profile fields are currently passed as loose objects across server actions and components.

## Boundary rules going forward

- Server-only helpers such as `lib/supabase/server.ts` must only be imported by Server Components, Route Handlers, server actions, or server-only utilities.
- Client components should use browser-safe clients from `lib/supabase/client.ts` and must not import server-only modules.
- App Router route modules must export valid HTTP handlers only.
- App Router pages using `useSearchParams()` must isolate that hook in a Client Component wrapped by Suspense.
- Next.js 15 dynamic route pages should treat `params` as async.
- Shared types should live in canonical shared modules; UI-local shapes should be named narrowly and not exported as product contracts.
