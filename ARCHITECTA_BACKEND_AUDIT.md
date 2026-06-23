# Architecta Backend Audit

**Date:** 2026-06-23
**Auditor:** Claude (senior full-stack / backend audit pass)
**Scope:** Entire `C:\DevProjects\architecta` codebase
**Method:** File-by-file inspection of `app/`, `lib/`, `components/`, `middleware.ts`, env, package manifests, and routing. Database schema inferred from code references (no SQL migrations are checked into the repo).

Legend: ✅ Built · 🟡 Partial · 🟣 Placeholder/mock · ❌ Missing · 🔴 Broken/security issue

---

## 1. Executive Summary

Architecta is a **Next.js 15 (App Router) + Supabase + Anthropic/OpenAI** product. The visible UI is well-developed, but **most user-facing features are still wired to mock generators**, not real AI calls. Real backend exists in three pockets:

1. **Auth + onboarding** (production-grade, persists to `profiles`, `onboarding_sessions`, `brand_profiles`).
2. **Studio** (`/api/studio/*`) — generate, refine, save, learn. Uses OpenAI directly with a real founder-style + memory loop.
3. **LLM gateway** (`/api/llm/generate`) — provider abstraction, routing, fallback, usage logging stub. **Not consumed by any UI yet.**

Everything else — Generate page, Content Strategy, Content Architect, Strategy Engine, Library, Brand Kit wizard, Calendar, Campaigns, Analytics, SEO, Settings → AI provider toggle — is **frontend-only or mock-backed**.

**Backend completion estimate: ~25–30 %.**
- Foundation (Supabase, middleware, auth, onboarding tables, LLM gateway scaffold): ✅
- Studio persistence + AI: 🟡 working but on its own provider path
- Content generation (the actual product surface): 🟣 mostly mocked
- Image/video generation: ❌ none in repo
- Settings + provider-switching: 🔴 wired to the wrong table

The single biggest gap is that **the LLM gateway and the user-facing generators do not meet**. Plumbing them together is the highest-leverage next step.

---

## 2. Current Backend Status

### What runs server-side today

| Area | Status | Notes |
|---|---|---|
| Supabase auth (shared `entrepreneuria.io` cookie) | ✅ | `middleware.ts`, `lib/supabase/{server,service,client,cookies}.ts` |
| Profile gating (`onboarding_complete`, `architecta_access`) | ✅ | `middleware.ts` + `lib/auth/profile.ts` |
| Onboarding persistence (`profiles`, `onboarding_sessions`, `brand_profiles`) | ✅ | `lib/onboarding/server.ts`, `lib/onboarding/actions.ts` |
| `POST /api/llm/generate` (provider router + fallback + usage log) | 🟡 | Built, **not called by any client** |
| `GET /api/llm` | ✅ | Health/index handler only |
| `GET\|POST /api/founder-style` | ✅ | Versioned founder-style profile read/write |
| `POST /api/studio/generate` | 🟡 | Hard-coded to OpenAI `gpt-4.1-mini`; bypasses gateway |
| `POST /api/studio/refine` | 🟡 | Same — OpenAI direct |
| `POST /api/studio/learn` | 🟡 | Same — OpenAI direct |
| `POST /api/studio/save` | 🟡 | Writes `studio_graphs`; also inserts `ai_edit_memory` |
| `GET /api/studio/load` | 🔴 | **No auth check** + reads from `architecta_graphs` (different table than save) |
| Brand profile CRUD | 🟡 | Created during onboarding; no edit endpoint after that |
| User settings table | 🟡 | Stored on `brand_profiles.ai_preferences` JSON — not exposed via API |
| Content calendar / campaigns / posts / generated assets / analytics tables | ❌ | Not present in code; UI shows "Coming Soon" |
| Usage tracking | 🟡 | `console.log` only — `architecta_llm_usage` table is referenced in a TODO |
| Validation | 🟡 | Lightweight per-route, no Zod schemas (zod is a dependency but unused for routes) |
| Logging | 🟣 | `console.*` only |
| Rate limiting | ❌ | None |
| Premium gating | 🟡 | `lib/auth/entitlements.ts` → `canUseClaude(plan)` is used by `lib/ai/actions/anthropic.ts` only |
| SQL migrations | ❌ | None checked in; schema lives on the remote Supabase project |

### Tables referenced in code (the de-facto schema)

`profiles`, `onboarding_sessions`, `brand_profiles`, `prospra_brand_profiles` (cross-app import), `founder_style_profiles`, `memory_events`, `ai_edit_memory`, `studio_graphs` (save target), `architecta_graphs` (load target — likely the same table under an old/new name), `workspaces` (`llm_preference` column).

---

## 3. Current Frontend Status

| Page | UI | Backend wiring | Status |
|---|---|---|---|
| `/` landing | ✅ | n/a | ✅ |
| `/auth/login`, `/auth/signup`, `/auth/check-email`, `/auth/callback` | ✅ | Supabase SSR | ✅ |
| `/onboarding/*` (10+ steps) | ✅ | server actions, persisted | ✅ |
| `/dashboard` | ✅ | Reads `useAuthIdentity` only | 🟡 mostly static |
| `/brand-kit` (wizard) | ✅ | **No `onSave`** — `Complete` only flips local state | 🟣 not persisted |
| `/generate` (GenerateStudio) | ✅ | `await new Promise(setTimeout 2000)` + `generateMockContent` + `Math.random` score | 🟣 fully mocked |
| `/content-strategy` | ✅ | `generateMockContentStrategy` | 🟣 fully mocked |
| `/content-architect` | ✅ | `generateMockContentArchitectPlan` | 🟣 fully mocked |
| `/strategy-engine` | ✅ | `generateMockStrategyEnginePlan` | 🟣 fully mocked |
| `/studio` | ✅ | `/api/studio/{save,generate,refine,learn,load}` | ✅ real backend |
| `/library` | ✅ | `mockContentItems` from `lib/mock-data.ts` | 🟣 fully mocked |
| `/calendar` | 🟣 | "Coming soon" card linking to Campaigns/Generate | 🟣 |
| `/campaigns` | 🟣 | `EmptyState` "Coming Soon" | 🟣 |
| `/analytics` | 🟣 | `EmptyState` "Coming Soon" | 🟣 |
| `/seo` | 🟣 | "Coming soon" card | 🟣 |
| `/settings` | ✅ | Only the `ClaudeToggle` is wired (broken — see §8) | 🟡 |
| `/access-denied`, `/not-found` | ✅ | n/a | ✅ |

---

## 4. AI Integration Status

| Capability | Status | Where |
|---|---|---|
| Anthropic SDK installed | ✅ | `@anthropic-ai/sdk` 0.71.2 |
| OpenAI SDK installed | ✅ | `openai` 6.15.0 |
| `ANTHROPIC_API_KEY` env wired | ✅ | `.env.example`, `lib/ai/providers/anthropic.ts`, `lib/ai/llm/providers/anthropic.ts` |
| `OPENAI_API_KEY` env wired | ✅ | `.env.example`, `lib/ai/actions/openai.ts`, `lib/ai/llm/providers/openai.ts`, every studio route |
| Provider abstraction (`LlmClient`) | ✅ | `lib/ai/llm/{types,gateway,router,providers}` |
| Task-based routing + tiering | ✅ | `lib/ai/llm/tasks.ts` (7 task types × draft/standard/premium) |
| Per-call fallback + retry | ✅ | `lib/ai/llm/gateway.ts` |
| Usage logging | 🟣 | `console.log` stub in `lib/ai/llm/usage/logger.ts`, table not created |
| Server-side AI calls only | ✅ | All AI clients import `server-only` or live in `"use server"` modules |
| User preference (Claude vs OpenAI vs auto) | 🔴 | Two **incompatible** systems: `setClaudePreference` writes `brand_profiles.ai_preferences.preferClaude`; gateway reads `workspaces.llm_preference`. Toggle UI starts at `initial={false}` regardless of stored value. |
| Image generation | ❌ | No code anywhere (`openai.images`, `dall-e`, `gpt-image`) |
| Video generation | ❌ | None |
| Text-gen used by `/generate` UI | ❌ | Page is mocked |
| Text-gen used by Strategy / Architect / Engine UI | ❌ | All mocked |
| Mocked AI responses in production paths | 🟣 | `lib/strategy/*.ts`, `components/generate/generate-studio.tsx`, `lib/mock-data.ts` |

There are **two parallel AI layers** in `lib/ai/`:

1. The older `lib/ai/router.ts` + `lib/ai/actions/{anthropic,openai}.ts` (used by `lib/brand-kit/generate.ts` and `ClaudeToggle`). Boolean `preferClaude` only.
2. The newer canonical `lib/ai/llm/*` gateway. Provider abstraction + task routing. Used only by `/api/llm/generate` which no UI calls.

These should converge.

---

## 5. Database Status

No SQL migrations are checked into the repo (`find -name "*.sql"` returns nothing). All schema is inferred from `.from("...")` calls. There is no `database.types.ts` generated from Supabase.

**Inferred existing tables** (from code): `profiles`, `onboarding_sessions`, `brand_profiles`, `founder_style_profiles`, `memory_events`, `ai_edit_memory`, `studio_graphs` (or `architecta_graphs`), `workspaces`.

**Tables the product clearly needs that don't appear anywhere in code:**

- `architecta_user_settings` (AI provider/model/image/video preferences, brand defaults, platform defaults)
- `architecta_content_strategies`
- `architecta_campaigns`
- `architecta_posts`
- `architecta_content_calendar_items`
- `architecta_generated_assets`
- `architecta_llm_usage` (referenced as a TODO in the usage logger)

RLS, indexes, and policies cannot be assessed without inspecting the live project. Recommend running `mcp__supabase__list_tables` and `get_advisors` on the live project before Phase 1 of the build.

---

## 6. Feature-by-Feature Audit

### Business / Brand Profile
| | Status | Notes |
|---|---|---|
| Create | ✅ | Auto-created on first onboarding step |
| Edit during onboarding | ✅ | `updateArchitectaOnboarding` + Prospra import |
| Edit after onboarding | ❌ | `/brand-kit` wizard does not save; settings page has no brand fields |
| Retrieve in AI prompts | 🟡 | Studio route reads brand from request body, not DB |

### Content Strategy
| | Status |
|---|---|
| Generate | 🟣 mock |
| Save / edit / regenerate | ❌ |
| Reuse in calendar/posts | ❌ |

### Content Calendar
| | Status |
|---|---|
| UI | 🟣 "Coming soon" |
| Persistence, status, filtering | ❌ |

### Post Generator
| | Status |
|---|---|
| Generate caption/hooks/hashtags/CTA | 🟣 mock |
| Generate image prompts | ❌ |
| Generate video prompts | ❌ |
| Save / regenerate / approve | ❌ |
| Generate actual image | ❌ |
| Generate actual video | ❌ |

### Campaign Generator
| | Status |
|---|---|
| All | 🟣 "Coming soon" |

### Image / Video Generation
| | Status |
|---|---|
| Any of it | ❌ |

### Settings
| | Status |
|---|---|
| AI provider toggle UI | 🔴 wired to wrong table, initial state ignored |
| Model preference UI | ❌ |
| Brand defaults | ❌ |
| Platform defaults | ❌ |
| Image/video preferences | ❌ |

### Auth / User Data
| | Status |
|---|---|
| Login (shared SSO) | ✅ |
| Middleware route protection | ✅ |
| User-scoped DB rows | ✅ (consistently uses `user_id = session.user.id`) |
| RLS | ❓ (cannot verify from code; service-role client used in several routes, so RLS would not enforce on those reads) |

---

## 7. Missing Backend Features

1. **Real AI for `/generate`, `/content-strategy`, `/content-architect`, `/strategy-engine`** — all are mocks today.
2. **Brand-kit save endpoint** + binding the existing wizard's "Complete" button to it.
3. **Settings API** — provider/model preference + brand/platform defaults, persisted on a real settings table.
4. **Content persistence** — posts, calendar items, campaigns, generated assets.
5. **Image generation** route (OpenAI `images.generate`).
6. **Video generation** route (OpenAI Sora when in your tier, otherwise return prompt + storyboard only).
7. **Usage tracking** — replace `console.log` stub with `architecta_llm_usage` insert; surface in UI.
8. **Library** — replace `mockContentItems` with a real list-posts endpoint.
9. **Analytics** — at minimum, aggregate from `architecta_posts` + `architecta_llm_usage`.
10. **Zod validation** at every route boundary (dep is already installed, just unused).
11. **Rate limiting** on `/api/llm/generate` and image/video routes (cost containment).

---

## 8. Security Issues 🔴

1. **`/api/studio/load` has no auth check.** It accepts `?graphId=` and returns the row directly. Any authenticated *or unauthenticated* user can read any graph by guessing/iterating IDs. ⚠️
2. **Service-role client used before some auth checks.** `studio/generate`, `studio/learn`, `studio/load`, `founder-style` all build a `createSupabaseServiceClient()` and only then call `getAuthenticatedUser`. If the auth check ever regresses, RLS is already bypassed because the service-role key skips it. Pattern should be: use the cookie-bound server client to verify auth, then escalate to service-role only for the specific writes that need it.
3. **Settings provider toggle is broken.** `ClaudeToggle` calls `setClaudePreference` which writes to `brand_profiles.ai_preferences.preferClaude`, but the LLM gateway reads `workspaces.llm_preference`. The two are not connected, so user choice is silently ignored by the new gateway.
4. **`ClaudeToggle initial={false}`** is hard-coded — the toggle never reflects the persisted value.
5. **Schema drift.** Save writes `studio_graphs`; Load reads `architecta_graphs`. Either the save is dead-letter or the load is broken. Either way, save+load round-trip cannot succeed.
6. **Module-load side effects throw.** `lib/ai/providers/anthropic.ts` throws at import time if `ANTHROPIC_API_KEY` is missing. Same for `lib/ai/llm/providers/{openai,anthropic}.ts`. This can take down unrelated routes during local/CI builds.
7. **No Zod validation** despite zod being installed — input validation is ad-hoc and inconsistent (e.g., `studio/save` checks shape via `isStudioGraph`, `llm/generate` only checks for required keys, `studio/load` does no validation at all).
8. **No rate limiting** on AI routes. A single user could rack up costs.
9. **No CSRF protection on server actions** beyond Next's defaults (acceptable, but worth documenting).
10. **`console.log` of full prompts and IDs** in the LLM usage logger — fine for now, but ensure no PII before going to production logs.

No `NEXT_PUBLIC_*` exposes a secret today. ✅

---

## 9. Recommended Architecture

```
app/
  api/
    brand-profile/                  GET, PUT
    settings/                       GET, PUT
    strategies/                     GET, POST, PATCH
    posts/                          GET, POST, PATCH, DELETE
    posts/[id]/regenerate           POST
    posts/[id]/revise               POST
    campaigns/                      GET, POST
    calendar/                       GET, PATCH
    assets/image/                   POST       ← OpenAI image gen
    assets/video/                   POST       ← OpenAI video gen (or storyboard fallback)
    usage/                          GET
    llm/generate/                   POST       ← existing gateway (keep)
    studio/...                      (existing)
    founder-style/                  (existing)

lib/
  ai/
    llm/                            ← THE gateway. Everything else dies.
      gateway.ts
      router.ts
      tasks.ts
      providers/anthropic.ts
      providers/openai.ts
      providers/openai-images.ts    ← NEW
      providers/openai-video.ts     ← NEW (or stub)
      prompts/
        strategy.ts
        post.ts
        campaign.ts
        image-prompt.ts
      usage/logger.ts               ← write to architecta_llm_usage
      preferences.ts                ← single source of truth for user prefs
  domain/                           (keep)
  supabase/                         (keep)
  auth/                             (keep)
  validation/                       ← NEW: Zod schemas per route
```

Kill `lib/ai/router.ts` + `lib/ai/actions/{anthropic,openai}.ts` after migrating their callers (`brand-kit/generate.ts`, `ClaudeToggle`) onto the gateway.

---

## 10. Recommended Database Schema

All tables RLS-enabled, owner-scoped on `user_id` (and optionally `workspace_id`), with `created_at`/`updated_at` timestamps and `gen_random_uuid()` PKs.

```sql
-- AI provider + model preferences
architecta_user_settings (
  user_id uuid PK references auth.users,
  workspace_id uuid null,
  text_provider text check (text_provider in ('anthropic','openai','auto')) default 'anthropic',
  anthropic_model text default 'claude-sonnet-4-5',
  openai_text_model text default 'gpt-4o',
  openai_image_model text default 'gpt-image-1',
  openai_video_model text null,
  default_platforms text[] default '{linkedin,instagram,x}',
  approval_required boolean default false,
  image_style jsonb default '{}',
  video_style jsonb default '{}',
  updated_at timestamptz default now()
)

architecta_content_strategies (
  id uuid PK,
  user_id uuid, workspace_id uuid,
  brand_profile_id uuid references brand_profiles,
  summary text,
  pillars jsonb,                -- StrategySection[]
  platform_strategy jsonb,
  posting_cadence jsonb,
  campaigns_seed jsonb,
  source_input jsonb,           -- the form values
  status text check (status in ('draft','active','archived')) default 'draft',
  created_at, updated_at
)

architecta_campaigns (
  id uuid PK,
  user_id, workspace_id, strategy_id uuid null,
  name text, theme text, goal text,
  launch_date date null,
  status text check (status in ('idea','planning','active','complete')) default 'idea',
  meta jsonb,
  created_at, updated_at
)

architecta_posts (
  id uuid PK,
  user_id, workspace_id, campaign_id uuid null, calendar_item_id uuid null,
  platform text,                -- linkedin/instagram/x/facebook/tiktok/pinterest/blog/email
  hook text, caption text,
  hashtags text[], cta text,
  image_prompt text, video_prompt text,
  status text check (status in ('idea','draft','approved','scheduled','published','archived')) default 'draft',
  ai_provider text, ai_model text,
  source_strategy_id uuid null,
  meta jsonb,                   -- regeneration history, scores, etc.
  created_at, updated_at, published_at timestamptz null
)

architecta_content_calendar_items (
  id uuid PK,
  user_id, workspace_id,
  post_id uuid references architecta_posts(id) on delete set null,
  scheduled_for timestamptz,
  platform text,
  status text check (status in ('idea','draft','approved','scheduled','published')) default 'idea',
  notes text,
  created_at, updated_at
)

architecta_generated_assets (
  id uuid PK,
  user_id, workspace_id,
  post_id uuid null references architecta_posts(id) on delete cascade,
  asset_type text check (asset_type in ('image','video')),
  provider text,
  model text,
  prompt text,
  storage_path text,             -- Supabase Storage
  external_url text null,
  width int null, height int null, duration_seconds int null,
  meta jsonb,
  created_at
)

architecta_llm_usage (
  id bigserial PK,
  user_id, workspace_id null,
  task text, tier text,
  provider text, model text,
  input_tokens int, output_tokens int, total_tokens int,
  cost_usd numeric(10,5),
  used_fallback boolean,
  latency_ms int,
  route_reason text,
  meta jsonb,
  created_at timestamptz default now()
)
```

Indexes: every table on `(user_id, created_at desc)`; `architecta_posts` on `(user_id, status)` and `(campaign_id)`; `architecta_content_calendar_items` on `(user_id, scheduled_for)`; `architecta_llm_usage` on `(user_id, created_at desc)`.

RLS template (per table):
```sql
alter table architecta_posts enable row level security;
create policy "owner_select" on architecta_posts for select using (auth.uid() = user_id);
create policy "owner_modify" on architecta_posts for all     using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## 11. Recommended API / Server Actions

| Method + Path | Purpose |
|---|---|
| `GET /api/brand-profile` | Read |
| `PUT /api/brand-profile` | Update (used by brand-kit wizard "Complete") |
| `GET /api/settings` | Read provider/model/defaults |
| `PUT /api/settings` | Update |
| `POST /api/strategies` | Generate + save a strategy (calls `/lib/ai/llm` gateway) |
| `GET /api/strategies` / `[id]` | List / read |
| `PATCH /api/strategies/[id]` | Edit / regenerate |
| `POST /api/posts` | Generate + save a post |
| `POST /api/posts/[id]/revise` | Server-side LLM revision |
| `POST /api/posts/[id]/regenerate` | Full regen |
| `PATCH /api/posts/[id]` | Status changes (draft → approved → scheduled → published) |
| `GET /api/posts` | List with filters |
| `DELETE /api/posts/[id]` | Delete |
| `POST /api/campaigns` | Generate campaign package (returns campaign + child posts) |
| `GET /api/campaigns` / `[id]` | List / read |
| `GET /api/calendar` | List items in range |
| `PATCH /api/calendar/[id]` | Reschedule / restatus |
| `POST /api/assets/image` | OpenAI image gen → Supabase Storage → row in `architecta_generated_assets` |
| `POST /api/assets/video` | OpenAI video gen (or storyboard fallback) |
| `GET /api/usage` | Aggregate from `architecta_llm_usage` |

All new routes: Zod validation → `getAuthenticatedUser` on the cookie-bound server client → escalate to service-role only for writes that need it → return the canonical `{ ok, data | error }` envelope.

---

## 12. Step-by-Step Implementation Plan

### Phase 1 — Backend foundation (1–2 days)
- Write SQL migrations for all 7 missing tables; commit them to `supabase/migrations/`.
- Run `supabase gen types typescript` and commit `lib/supabase/database.types.ts`.
- Add `lib/validation/` Zod schemas matching each new table.
- Add `architecta_llm_usage` insert to the gateway logger (replace `console.log`).
- Fix the two **🔴** bugs: add auth to `/api/studio/load`; unify `studio_graphs` vs `architecta_graphs` (pick one).
- Refactor service-role usage: cookie-bound client to auth, service-role only for the specific writes.

### Phase 2 — AI provider layer consolidation (0.5 day)
- Delete `lib/ai/router.ts` + `lib/ai/actions/{anthropic,openai}.ts`. Migrate `lib/brand-kit/generate.ts` and `ClaudeToggle` onto `lib/ai/llm/*`.
- Replace `setClaudePreference` with `setUserAiPreference(provider, anthropicModel, openaiTextModel, openaiImageModel)` writing to `architecta_user_settings`.
- Rewrite `getWorkspaceLlmPreference` to read `architecta_user_settings` (keyed on user, optional workspace).
- Make the providers lazy-load: only throw on missing key when `generate()` is first called, not on module import.

### Phase 3 — Core content generation (2–3 days)
- `POST /api/strategies` → real Anthropic call (default) routed through gateway; persist.
- `POST /api/posts` → real generation with brand profile + founder-style context.
- `POST /api/posts/[id]/{revise,regenerate}` → reuse the studio refine pattern.
- Replace `generateMockContent*` in `components/generate/generate-studio.tsx`, `content-strategy-studio.tsx`, `content-architect-studio.tsx`, `strategy-engine-workflow.tsx` with real fetches.
- Wire the brand-kit wizard "Complete" button to `PUT /api/brand-profile`.

### Phase 4 — Calendar & campaigns (1.5 days)
- `POST /api/campaigns` → multi-post fan-out (one campaign, N child posts inserted under it).
- `GET /api/calendar` + `PATCH /api/calendar/[id]`.
- Replace placeholder pages with real list + drag-rescheduling UI.

### Phase 5 — Image / video (1–2 days)
- `lib/ai/llm/providers/openai-images.ts` (`gpt-image-1`), uploaded to Supabase Storage bucket `architecta-assets/`.
- `POST /api/assets/image` and `POST /api/assets/video`.
- Attach asset row to `architecta_posts.image_asset_id` / `video_asset_id`.
- If your OpenAI tier doesn't support Sora, return the prompt + storyboard JSON and surface as a "ready to render externally" state.

### Phase 6 — Settings UI & polish (1 day)
- Settings page: provider radio (Anthropic/OpenAI/Auto), Anthropic model select, OpenAI text + image model selects, brand defaults, platform defaults, approval-required switch.
- Replace `ClaudeToggle` entirely.
- Empty/loading/error states across Library, Calendar, Campaigns, Analytics.

### Phase 7 — Testing & hardening (1 day)
- API tests for the new routes (auth, validation, ownership filter).
- RLS policy tests against the live project via `mcp__supabase__execute_sql`.
- Add rate-limit middleware (`@upstash/ratelimit` or Supabase Edge function) to AI routes.
- Add `architecta_llm_usage` read endpoint + a small usage card on the dashboard.

---

## 13. Suggested Build Order (Critical Path)

1. SQL migrations + types (unblocks everything)
2. Fix 🔴 security bugs (load auth, table drift, service-role pattern)
3. Consolidate AI layer onto gateway
4. Brand-profile save endpoint + wire wizard
5. Settings API + UI
6. Strategies API + wire Content-Strategy / Strategy-Engine / Content-Architect pages
7. Posts API + wire Generate page + Library
8. Campaigns + Calendar
9. Image generation
10. Video generation (or storyboard)
11. Usage tracking surface
12. Rate limiting + hardening

---

## 14. Files to Create

- `supabase/migrations/0001_architecta_core.sql` (all 7 new tables + RLS)
- `lib/supabase/database.types.ts` (generated)
- `lib/validation/{settings,brand,strategy,post,campaign,asset}.ts` (Zod)
- `lib/ai/llm/providers/openai-images.ts`
- `lib/ai/llm/providers/openai-video.ts`
- `lib/ai/llm/prompts/{strategy,post,campaign,image-prompt}.ts`
- `app/api/brand-profile/route.ts`
- `app/api/settings/route.ts`
- `app/api/strategies/route.ts`, `app/api/strategies/[id]/route.ts`
- `app/api/posts/route.ts`, `app/api/posts/[id]/route.ts`, `app/api/posts/[id]/revise/route.ts`, `app/api/posts/[id]/regenerate/route.ts`
- `app/api/campaigns/route.ts`, `app/api/campaigns/[id]/route.ts`
- `app/api/calendar/route.ts`, `app/api/calendar/[id]/route.ts`
- `app/api/assets/image/route.ts`, `app/api/assets/video/route.ts`
- `app/api/usage/route.ts`
- `components/settings/AiProviderSettings.tsx` (replaces `ClaudeToggle`)
- `components/settings/BrandDefaults.tsx`

## 15. Files to Modify

- `app/api/studio/load/route.ts` — add auth check, fix table name.
- `app/api/studio/save/route.ts` — match table name to load.
- `app/api/studio/{generate,learn,refine}/route.ts` — route through the gateway, drop direct OpenAI imports.
- `lib/ai/llm/workspacePrefs.ts` — read from `architecta_user_settings`.
- `lib/ai/llm/usage/logger.ts` — insert into `architecta_llm_usage`.
- `lib/ai/llm/providers/{anthropic,openai}.ts` — lazy-load API key; do not throw at import.
- `lib/brand-kit/generate.ts` — use gateway instead of `runAI`.
- `components/brand-kit/brand-kit-wizard.tsx` — call `PUT /api/brand-profile` on Complete.
- `components/generate/generate-studio.tsx` — call `POST /api/posts`.
- `components/content-strategy/content-strategy-studio.tsx` — call `POST /api/strategies`.
- `components/content-architect/content-architect-studio.tsx` — call `POST /api/strategies` (architect variant).
- `components/strategy-engine/strategy-engine-workflow.tsx` — call `POST /api/strategies` (engine variant).
- `components/library/content-library.tsx` — fetch from `GET /api/posts`.
- `app/calendar/page.tsx`, `app/campaigns/page.tsx`, `app/analytics/page.tsx` — replace EmptyState with real shells once data exists.
- `app/settings/page.tsx` — render the new `AiProviderSettings`.
- `middleware.ts` — no changes; protected list is already correct.
- Delete: `lib/ai/router.ts`, `lib/ai/actions/anthropic.ts`, `lib/ai/actions/openai.ts`, `lib/ai/actions/preferences.ts`, `components/settings/ClaudeToggle.tsx`, `lib/mock-data.ts` (after Library is migrated), `generateMock*` functions in `lib/strategy/*.ts`.

---

## 16. Risks & Unknowns

- **Live schema vs inferred schema.** No migrations checked in; cannot be 100 % sure which Supabase tables exist. Run `list_tables` on the live project before Phase 1.
- **`workspaces` table** is referenced by `getWorkspaceLlmPreference` but no other code reads/writes it. Unknown whether workspace scoping is actually used.
- **Studio table drift** (`studio_graphs` vs `architecta_graphs`) — unclear which is canonical; need to inspect live DB.
- **OpenAI video tier.** Sora API access varies by account; the implementation needs a runtime fallback.
- **RLS** cannot be verified from code alone; the use of service-role in several routes means RLS gaps might be hidden today.
- **Prospra cross-app import.** `lib/onboarding/actions.ts` reads `prospra_brand_profiles` directly; that table presumably lives in the same Supabase project but is owned by another app.
- **Workspace identity.** `LlmGenerateInput.workspaceId` is required, but most pages don't have a workspaceId — only `useAuthIdentity` exposes a workspace *name*. The gateway will silently fall back to `auto` for unknown workspaces today.

---

## 17. Final Recommendation

**Don't build new features yet.** The base architecture is sound (good domain types, a real gateway scaffold, working auth and onboarding), but four things are quietly broken or missing in ways that will compound:

1. The LLM gateway has nobody calling it.
2. The settings system writes to a table the gateway never reads.
3. Save/Load in Studio target different tables.
4. There is no way to persist anything the user generates outside Studio — and Studio itself is bypassed by every product-surface page.

Fix those four, plus add the seven missing tables, before adding image/video/campaigns. The order in §13 keeps every step independently shippable.

After Phase 1–3, Architecta becomes a working AI content product. Phases 4–7 turn it into the strategy/campaign/asset platform described in the brief.

---

*Report saved to `ARCHITECTA_BACKEND_AUDIT.md` at the repository root.*
