# Architecta v1 Foundation

## Canonical Domain Model Overview

Canonical v1 contracts live in `lib/domain`.

- `common.ts`: shared entity IDs, ISO date strings, and the standard API envelope.
- `auth.ts`: authenticated user, session user, and profile contracts.
- `brand.ts`: business profile, brand kit, founder style profile, audience, topics, and examples.
- `workspace.ts`: workspace and project contracts.
- `studio.ts`: Studio graph, nodes, edges, generated versions, suggestions, selected nodes, and memory signals.
- `generation.ts`: generation requests/results, generation controls, revision controls, and memory bias hints.
- `llm.ts`: model providers, preferences, task routing inputs, model choices, LLM clients, usage, and results.
- `content.ts`: content item/status/type and performance summary contracts.
- `analytics.ts`: analytics summary and campaign contracts.

Legacy entry points such as `lib/types.ts`, `components/studio/studioTypes.ts`, and `lib/ai/llm/types.ts` now re-export canonical contracts where practical. New code should import from `lib/domain` directly.

## Module Boundaries

- `lib/domain`: shared type-only contracts and small type guards. No database access, no React, no provider SDKs.
- `lib/api`: route-handler helpers for request parsing and response envelopes.
- `lib/auth`: auth lifecycle helpers. Server helpers must stay server-only.
- `lib/supabase`: Supabase client factories. Browser, anon server, and service-role clients stay separated.
- `lib/ai/llm`: provider/gateway/routing abstractions. Routes should call this layer rather than embedding provider logic where possible.
- `app/api`: request validation, auth checks, adapter mapping between database rows and domain contracts, then response envelopes.
- `components`: UI rendering and client interaction. Components should consume typed API response shapes and should not import server-only helpers.

## API Contract Conventions

All newly normalized API routes return:

```ts
type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> } };
```

Use `apiOk`, `apiError`, and `parseJsonBody` from `lib/api/response`.

Current normalized routes include:

- `GET /api/llm`
- `POST /api/llm/generate`
- `GET|POST /api/founder-style`
- `POST /api/studio/generate`
- `POST /api/studio/refine`
- `POST /api/studio/learn`
- `GET /api/studio/load`
- `POST /api/studio/save`

Routes should validate required fields before calling provider or database code. Route handlers should map database snake_case fields into domain camelCase contracts at the boundary.

## Auth Lifecycle Conventions

- Server-side route handlers should use Supabase server/service clients only from server-only modules.
- Use `getAuthenticatedUser` for consistent session user extraction.
- Client components should not directly assume database profile shape. They should read domain-shaped API responses.
- Middleware remains the routing guard, but profile/session assumptions should continue moving into typed helpers.

## Generation and LLM Foundation

Generation request/response contracts live in `lib/domain/generation.ts`.

LLM provider and routing contracts live in `lib/domain/llm.ts`, with `lib/ai/llm/types.ts` acting as a compatibility export.

Provider logic should stay behind `LlmClient` implementations. API routes should validate the request, inject system prompts or memory context, call the gateway/provider layer, and return typed results.

## Placeholder vs Production-Ready

Production-ready foundations added in this pass:

- Canonical domain contracts.
- Standard API envelope.
- Typed auth/session extraction helper.
- Typed founder-style, studio, generation, refine, learn, load, save, and LLM route boundaries.
- Analytics and campaigns placeholders now reference stable contracts.

Still placeholder or incomplete:

- Campaign management UI/data persistence.
- Analytics ingestion and reporting.
- Studio graph loading into the active canvas.
- Full database schema typing from Supabase generated types.
- LLM gateway adoption by all generation routes.
- Remaining lint warnings and text encoding cleanup.
