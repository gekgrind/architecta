/**
 * Dashboard data model.
 *
 * Pure mapping from persisted Architecta records to what the dashboard shows.
 * Nothing here invents data: every value traces back to a row the user (or an
 * Architecta generation they ran) produced. When a source failed to load, its
 * section reports "error" — it is never silently replaced with an empty or
 * placeholder value.
 */

import {
  eligibleStrategies,
  normalizeStrategyRecord,
  selectCurrentStrategy,
} from "@/lib/strategy/strategy-record";

/* =======================================================
   Source shapes (subset of the persisted rows)
======================================================= */

export type LoadState<T> = { ok: true; data: T } | { ok: false };

export type BrandProfileSource = {
  brand_name: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  audience: string | null;
  typical_customers: string | null;
  offers: string | null;
  tone: string | null;
  tone_voice: string | null;
  voice_description: string | null;
  mission: string | null;
  source: Record<string, unknown> | null;
};

export type OnboardingSource = {
  id: string;
  status: string | null;
  answers: Record<string, unknown> | null;
};

export type WebsiteAnalysisSource = {
  status: string;
  url: string | null;
  completed_at: string | null;
  result: Record<string, unknown> | null;
};

export type StrategySource = {
  id: string;
  kind: string | null;
  title: string | null;
  summary: string | null;
  status: string | null;
  pillars: unknown;
  next_actions: unknown;
  quick_wins: unknown;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export type PostSource = {
  status: string;
  title: string | null;
  platform: string | null;
  scheduled_for: string | null;
};

export type CampaignSource = {
  status: string;
};

export type PublishLogSource = {
  status: string;
  platform: string | null;
  created_at: string;
};

export type ConnectionSource = {
  kind: "platform" | "destination";
  name: string;
  status: string;
};

export type DashboardSources = {
  brandProfile: LoadState<BrandProfileSource | null>;
  onboarding: LoadState<OnboardingSource | null>;
  websiteAnalysis: LoadState<WebsiteAnalysisSource | null>;
  strategies: LoadState<StrategySource[]>;
  posts: LoadState<PostSource[]>;
  campaigns: LoadState<CampaignSource[]>;
  publishLog: LoadState<PublishLogSource[]>;
  connections: LoadState<ConnectionSource[]>;
};

/* =======================================================
   Model
======================================================= */

export type SectionStatus = "ready" | "error";

export type KnowledgeSource = "brand_profile" | "website_analysis" | "onboarding";

export type KnowledgeField = {
  id: "name" | "description" | "audience" | "offers" | "voice" | "differentiators" | "competitors";
  label: string;
  value: string | null;
  values: string[];
  source: KnowledgeSource | null;
  /** Where the user can add or correct this fact, when such a place exists. */
  editHref: string | null;
};

export type KnowledgeContext = {
  id: "industry" | "market" | "pains" | "outcome" | "mission";
  label: string;
  value: string;
};

export type DashboardKnowledge = {
  status: SectionStatus;
  fields: KnowledgeField[];
  knownCount: number;
  totalCount: number;
  context: KnowledgeContext[];
};

export type DashboardWebsiteAnalysis = {
  status: "none" | "pending" | "failed" | "completed" | "error";
  domain: string | null;
  analyzedLabel: string | null;
  confidence: "high" | "medium" | "low" | null;
  differentiators: string[];
  topics: string[];
  ctaPatterns: string[];
};

export type StrategyPillarSummary = { id: string; title: string; description: string };

export type DashboardStrategy = {
  id: string;
  kindLabel: string;
  title: string;
  summary: string | null;
  status: string;
  /** True only for an explicitly activated strategy; the latest-draft fallback is never active. */
  isActive: boolean;
  statusLabel: "Active" | "Latest draft";
  createdLabel: string;
  pillars: StrategyPillarSummary[];
  focus: string[];
  priorities: string[];
  nextMoves: string[];
};

export type DashboardExecution = {
  status: SectionStatus;
  total: number;
  ideas: number;
  drafts: number;
  approved: number;
  scheduled: number;
  published: number;
  upcomingWeek: number;
  nextScheduled: { title: string; platform: string | null; label: string } | null;
};

export type DashboardPublishing = {
  status: SectionStatus;
  successes30d: number;
  failures30d: number;
  lastFailure: { platform: string | null; label: string } | null;
};

export type DashboardConnections = {
  status: SectionStatus;
  connected: number;
  needsAttention: number;
};

export type LoopStage = {
  id: "intelligence" | "strategy" | "execution" | "performance";
  label: string;
  value: string;
  /** Short qualifier rendered next to the value, e.g. "in pipeline". */
  unit?: string;
  caption: string;
  href: string;
  /** "awaiting": the stage has inputs but no measurement source is connected. */
  state: "established" | "partial" | "empty" | "awaiting" | "unavailable";
};

export type DashboardAction = {
  id: string;
  title: string;
  reason: string;
  href: string;
  cta: string;
  priority: "high" | "normal";
  source: "profile" | "strategy" | "content" | "publishing" | "setup";
};

export type DashboardModel = {
  business: {
    name: string | null;
    industry: string | null;
    website: string | null;
    description: string | null;
  };
  knowledge: DashboardKnowledge;
  websiteAnalysis: DashboardWebsiteAnalysis;
  strategy: { status: SectionStatus; latest: DashboardStrategy | null; savedCount: number };
  execution: DashboardExecution;
  campaigns: { status: SectionStatus; active: number; total: number };
  publishing: DashboardPublishing;
  connections: DashboardConnections;
  loop: LoopStage[];
  actions: DashboardAction[];
};

export type DashboardResult =
  | { status: "ready"; model: DashboardModel }
  | { status: "error"; message: string };

/* =======================================================
   Helpers
======================================================= */

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_DASHBOARD_ACTIONS = 5;

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => text(entry))
    .filter((entry): entry is string => entry !== null);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Deterministic, timezone-stable date label (identical on server and client). */
export function formatDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const STRATEGY_KIND_LABEL: Record<string, string> = {
  strategy_engine: "Growth strategy",
  content_strategy: "Content strategy",
  content_architect: "Content architecture plan",
  custom: "Strategy",
};

/* =======================================================
   Section builders
======================================================= */

function buildWebsiteAnalysis(
  state: LoadState<WebsiteAnalysisSource | null>,
  brand: BrandProfileSource | null
): DashboardWebsiteAnalysis {
  const empty: DashboardWebsiteAnalysis = {
    status: "none",
    domain: domainOf(brand?.website ?? null),
    analyzedLabel: null,
    confidence: null,
    differentiators: [],
    topics: [],
    ctaPatterns: [],
  };

  // The completed job is the richest source; the brand profile keeps a copy of
  // the insights that have no dedicated column (written at onboarding completion),
  // which still answers when the jobs table can't be read.
  const saved = record(record(brand?.source)?.websiteInsights);
  if (!state.ok && !saved) return { ...empty, status: "error" };

  const job = state.ok ? state.data : null;
  const result = job?.status === "completed" ? record(job.result) : null;
  const insights = result ?? saved;

  if (!insights) {
    if (job?.status === "queued" || job?.status === "processing") {
      return { ...empty, status: "pending", domain: domainOf(job.url) ?? empty.domain };
    }
    if (job?.status === "failed") {
      return { ...empty, status: "failed", domain: domainOf(job.url) ?? empty.domain };
    }
    return empty;
  }

  const confidence = text(insights.confidence);

  return {
    status: "completed",
    domain: domainOf(job?.url ?? null) ?? empty.domain,
    analyzedLabel: formatDateLabel(text(insights.analyzed_at) ?? job?.completed_at ?? null),
    confidence:
      confidence === "high" || confidence === "medium" || confidence === "low" ? confidence : null,
    differentiators: strings(insights.differentiators),
    topics: strings(insights.topics),
    ctaPatterns: strings(insights.cta_patterns),
  };
}

function buildKnowledge(
  brandState: LoadState<BrandProfileSource | null>,
  onboardingState: LoadState<OnboardingSource | null>,
  analysis: DashboardWebsiteAnalysis,
  analysisResult: Record<string, unknown> | null
): DashboardKnowledge {
  const brand = brandState.ok ? brandState.data : null;
  const answers = onboardingState.ok ? record(onboardingState.data?.answers) : null;

  const pick = (
    ...candidates: Array<[string | null, KnowledgeSource]>
  ): { value: string | null; source: KnowledgeSource | null } => {
    for (const [value, source] of candidates) {
      if (value) return { value, source };
    }
    return { value: null, source: null };
  };

  // Precedence: saved brand profile → the user's onboarding answers → the
  // website analysis (labelled as such, so the user can tell it was inferred).
  const name = pick(
    [text(brand?.brand_name), "brand_profile"],
    [text(answers?.brand_name), "onboarding"],
    [text(analysisResult?.brand_name), "website_analysis"]
  );
  const description = pick(
    [text(brand?.description), "brand_profile"],
    [text(answers?.description), "onboarding"],
    [text(analysisResult?.description), "website_analysis"]
  );
  const audience = pick(
    [text(brand?.audience), "brand_profile"],
    [text(brand?.typical_customers), "brand_profile"],
    [text(answers?.customer_role), "onboarding"],
    [text(analysisResult?.audience), "website_analysis"]
  );
  const offers = pick(
    [text(brand?.offers), "brand_profile"],
    [text(answers?.offers), "onboarding"],
    [text(analysisResult?.offers), "website_analysis"]
  );
  const voice = pick(
    [text(brand?.voice_description), "brand_profile"],
    [text(brand?.tone_voice), "brand_profile"],
    [text(brand?.tone), "brand_profile"],
    [text(analysisResult?.voice_characteristics), "website_analysis"]
  );
  const differentiators = analysis.differentiators;
  const competitors = strings(answers?.competitors);

  const fields: KnowledgeField[] = [
    { id: "name", label: "Business", ...name, values: [], editHref: "/brand-kit" },
    { id: "description", label: "What you do", ...description, values: [], editHref: "/brand-kit" },
    { id: "audience", label: "Audience", ...audience, values: [], editHref: "/brand-kit" },
    // The Brand Kit has no offers, differentiator or competitor inputs yet, so
    // those gaps are reported without pointing at a page that cannot fix them.
    { id: "offers", label: "Offers", ...offers, values: [], editHref: null },
    { id: "voice", label: "Brand voice", ...voice, values: [], editHref: "/brand-kit" },
    {
      id: "differentiators",
      label: "Differentiators",
      value: differentiators.length ? differentiators.join(" · ") : null,
      values: differentiators,
      source: differentiators.length ? "website_analysis" : null,
      editHref: null,
    },
    {
      id: "competitors",
      label: "Competitors",
      value: competitors.length ? competitors.join(", ") : null,
      values: competitors,
      source: competitors.length ? "onboarding" : null,
      editHref: null,
    },
  ];

  const context: KnowledgeContext[] = [];
  const industry =
    text(brand?.industry) ?? text(answers?.industry) ?? text(analysisResult?.industry);
  if (industry) context.push({ id: "industry", label: "Industry", value: industry });
  const market = text(answers?.primary_market) ?? text(answers?.niche);
  if (market) context.push({ id: "market", label: "Market", value: market });
  const pains = strings(answers?.customer_pains);
  if (pains.length) context.push({ id: "pains", label: "Customer pains", value: pains.join(", ") });
  const outcome = text(answers?.customer_outcome);
  if (outcome) context.push({ id: "outcome", label: "Desired outcome", value: outcome });
  const mission = text(brand?.mission);
  if (mission) context.push({ id: "mission", label: "Mission", value: mission });

  const status: SectionStatus = brandState.ok || onboardingState.ok ? "ready" : "error";

  return {
    status,
    fields,
    knownCount: fields.filter((field) => field.value !== null).length,
    totalCount: fields.length,
    context,
  };
}

function buildStrategy(state: LoadState<StrategySource[]>) {
  if (!state.ok) return { status: "error" as const, latest: null, savedCount: 0 };

  // Only business strategies qualify; an active one wins, otherwise the newest
  // draft is shown as a draft — never as the active strategy.
  const records = state.data.map(normalizeStrategyRecord);
  const current = selectCurrentStrategy(records);
  const savedCount = eligibleStrategies(records).length;

  if (!current) return { status: "ready" as const, latest: null, savedCount };

  const { record, isActive } = current;
  const kindLabel = STRATEGY_KIND_LABEL[record.kind] ?? "Strategy";

  const latest: DashboardStrategy = {
    id: record.id,
    kindLabel,
    title: record.title ?? kindLabel,
    summary: record.summary,
    status: record.status,
    isActive,
    statusLabel: isActive ? "Active" : "Latest draft",
    createdLabel: formatDateLabel(record.createdAt) ?? "",
    pillars: record.pillars
      .slice(0, 3)
      .map((pillar) => ({ id: pillar.id, title: pillar.title, description: pillar.description || (pillar.items[0] ?? "") })),
    focus: record.thirtyDayFocus.slice(0, 4),
    priorities: record.growthPriorities.slice(0, 4),
    nextMoves: [...record.nextActions, ...record.quickWins].slice(0, 4),
  };

  return { status: "ready" as const, latest, savedCount };
}

function buildExecution(state: LoadState<PostSource[]>, now: Date): DashboardExecution {
  const empty: DashboardExecution = {
    status: "ready",
    total: 0,
    ideas: 0,
    drafts: 0,
    approved: 0,
    scheduled: 0,
    published: 0,
    upcomingWeek: 0,
    nextScheduled: null,
  };
  if (!state.ok) return { ...empty, status: "error" };

  const posts = state.data.filter((post) => post.status !== "archived");
  const count = (status: string) => posts.filter((post) => post.status === status).length;
  const nowMs = now.getTime();

  const upcoming = posts
    .filter((post) => post.status === "scheduled" && post.scheduled_for)
    .map((post) => ({ post, at: new Date(post.scheduled_for as string).getTime() }))
    .filter(({ at }) => Number.isFinite(at) && at >= nowMs)
    .sort((a, b) => a.at - b.at);

  const next = upcoming[0];

  return {
    status: "ready",
    total: posts.length,
    ideas: count("idea"),
    drafts: count("draft"),
    approved: count("approved"),
    scheduled: count("scheduled"),
    published: count("published"),
    upcomingWeek: upcoming.filter(({ at }) => at - nowMs <= 7 * DAY_MS).length,
    nextScheduled: next
      ? {
          title: text(next.post.title) ?? "Untitled post",
          platform: next.post.platform,
          label: formatDateLabel(next.post.scheduled_for) ?? "",
        }
      : null,
  };
}

function buildPublishing(state: LoadState<PublishLogSource[]>, now: Date): DashboardPublishing {
  if (!state.ok) {
    return { status: "error", successes30d: 0, failures30d: 0, lastFailure: null };
  }

  const since = now.getTime() - 30 * DAY_MS;
  const recent = state.data.filter((row) => new Date(row.created_at).getTime() >= since);
  const failures = recent
    .filter((row) => row.status === "error")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    status: "ready",
    successes30d: recent.filter((row) => row.status === "success").length,
    failures30d: failures.length,
    lastFailure: failures[0]
      ? { platform: failures[0].platform, label: formatDateLabel(failures[0].created_at) ?? "" }
      : null,
  };
}

function buildConnections(state: LoadState<ConnectionSource[]>): DashboardConnections {
  if (!state.ok) return { status: "error", connected: 0, needsAttention: 0 };
  return {
    status: "ready",
    connected: state.data.filter((row) => row.status === "connected").length,
    needsAttention: state.data.filter((row) => row.status !== "connected").length,
  };
}

/* =======================================================
   Growth loop + next actions
======================================================= */

function buildLoop(model: Omit<DashboardModel, "loop" | "actions">): LoopStage[] {
  const { knowledge, strategy, execution } = model;

  const intelligence: LoopStage =
    knowledge.status === "error"
      ? {
          id: "intelligence",
          label: "Intelligence",
          value: "—",
          caption: "Business profile could not be loaded",
          href: "/brand-kit",
          state: "unavailable",
        }
      : {
          id: "intelligence",
          label: "Intelligence",
          value: `${knowledge.knownCount}/${knowledge.totalCount}`,
          caption: "business foundations known",
          href: "/brand-kit",
          state:
            knowledge.knownCount === knowledge.totalCount
              ? "established"
              : knowledge.knownCount > 0
                ? "partial"
                : "empty",
        };

  const strategyStage: LoopStage =
    strategy.status === "error"
      ? {
          id: "strategy",
          label: "Strategy",
          value: "—",
          caption: "Saved strategies could not be loaded",
          href: "/strategy-engine",
          state: "unavailable",
        }
      : strategy.latest
        ? {
            id: "strategy",
            label: "Strategy",
            value: strategy.latest.isActive ? "Active" : "Drafted",
            caption: `${strategy.latest.kindLabel} · ${strategy.latest.createdLabel}`,
            href: "/strategy-engine",
            state: "established",
          }
        : {
            id: "strategy",
            label: "Strategy",
            value: "None yet",
            caption: "No strategy generated",
            href: "/strategy-engine",
            state: "empty",
          };

  const inPipeline = execution.ideas + execution.drafts + execution.approved + execution.scheduled;
  const pipelineParts = [
    execution.ideas ? plural(execution.ideas, "idea") : null,
    execution.drafts ? plural(execution.drafts, "draft") : null,
    execution.approved ? `${execution.approved} approved` : null,
    execution.scheduled ? `${execution.scheduled} scheduled` : null,
  ].filter((part): part is string => part !== null);

  const executionStage: LoopStage =
    execution.status === "error"
      ? {
          id: "execution",
          label: "Execution",
          value: "—",
          caption: "Content could not be loaded",
          href: "/library",
          state: "unavailable",
        }
      : execution.total === 0
        ? {
            id: "execution",
            label: "Execution",
            value: "None yet",
            caption: "No content created",
            href: "/library",
            state: "empty",
          }
        : {
            id: "execution",
            label: "Execution",
            value: String(inPipeline),
            unit: "in pipeline",
            caption:
              pipelineParts.length > 0
                ? pipelineParts.slice(0, 3).join(" · ")
                : `Nothing in progress · ${execution.published} published`,
            href: "/library",
            state: "established",
          };

  // Architecta records what it publishes but collects no reach or engagement,
  // so this stage never presents publishing volume as a performance result.
  const performance: LoopStage =
    execution.status === "error"
      ? {
          id: "performance",
          label: "Performance",
          value: "—",
          caption: "Publishing data could not be loaded",
          href: "/analytics",
          state: "unavailable",
        }
      : {
          id: "performance",
          label: "Performance",
          value: "Awaiting data",
          caption: `${
            execution.published > 0 ? `${execution.published} published` : "Nothing published yet"
          } · engagement not connected`,
          href: "/analytics",
          state: execution.published > 0 ? "awaiting" : "empty",
        };

  return [intelligence, strategyStage, executionStage, performance];
}

export function buildNextActions(model: Omit<DashboardModel, "loop" | "actions">): DashboardAction[] {
  const actions: DashboardAction[] = [];
  const { knowledge, strategy, execution, publishing, connections } = model;

  if (publishing.status === "ready" && publishing.failures30d > 0) {
    const last = publishing.lastFailure;
    actions.push({
      id: "publish-failures",
      title: `Resolve ${plural(publishing.failures30d, "failed publish", "failed publishes")}`,
      reason: last
        ? `The most recent failure was${last.platform ? ` on ${last.platform}` : ""} on ${last.label}. Failed posts never reach your audience.`
        : "Failed posts never reach your audience.",
      href: "/calendar",
      cta: "Open calendar",
      priority: "high",
      source: "publishing",
    });
  }

  const missingEditable =
    knowledge.status === "ready"
      ? knowledge.fields.filter((field) => field.value === null && field.editHref)
      : [];
  const coreMissing = missingEditable.some(
    (field) => field.id === "name" || field.id === "description" || field.id === "audience"
  );

  if (strategy.status === "ready" && !strategy.latest) {
    actions.push({
      id: "first-strategy",
      title: "Build your first growth strategy",
      reason:
        knowledge.status === "ready" && knowledge.knownCount > 0
          ? `Architecta already knows ${knowledge.knownCount} of ${knowledge.totalCount} business foundations but has no saved strategy to turn them into priorities.`
          : "A strategy turns your business profile into priorities, content pillars and next moves.",
      href: "/strategy-engine",
      cta: "Open Strategy",
      priority: "high",
      source: "strategy",
    });
  }

  if (missingEditable.length > 0) {
    const labels = missingEditable.map((field) => field.label.toLowerCase());
    actions.push({
      id: "complete-profile",
      title: `Add your ${labels.slice(0, 2).join(" and ")}${labels.length > 2 ? " and more" : ""}`,
      reason: "Every strategy and draft is generated from your business profile. These foundations are still missing.",
      href: "/brand-kit",
      cta: "Update brand profile",
      priority: coreMissing ? "high" : "normal",
      source: "profile",
    });
  }

  if (execution.status === "ready") {
    const ready = execution.drafts + execution.approved;

    if (strategy.latest && execution.total === 0) {
      const pillar = strategy.latest.pillars[0]?.title;
      actions.push({
        id: "first-content",
        title: pillar ? `Create content for “${pillar}”` : "Create your first piece of content",
        reason: `Your ${strategy.latest.kindLabel.toLowerCase()} from ${strategy.latest.createdLabel} hasn't been turned into content yet.`,
        href: "/generate",
        cta: "Start creating",
        priority: "normal",
        source: "strategy",
      });
    } else if (ready > 0 && execution.upcomingWeek === 0) {
      actions.push({
        id: "schedule-drafts",
        title: `Schedule ${plural(ready, "ready draft")}`,
        reason: "Nothing is scheduled to publish in the next 7 days.",
        href: "/calendar",
        cta: "Plan the week",
        priority: "normal",
        source: "content",
      });
    } else if (execution.drafts > 0) {
      actions.push({
        id: "review-drafts",
        title: `Review ${plural(execution.drafts, "draft")}`,
        reason: "Drafts waiting for review can't be scheduled or published.",
        href: "/library",
        cta: "Open library",
        priority: "normal",
        source: "content",
      });
    }
  }

  if (connections.status === "ready" && connections.connected === 0) {
    actions.push({
      id: "connect-channel",
      title: "Connect a publishing channel",
      reason: "Architecta can't publish for you — or learn from results — until a channel is connected.",
      href: "/settings",
      cta: "Open settings",
      priority: "normal",
      source: "setup",
    });
  } else if (connections.status === "ready" && connections.needsAttention > 0) {
    actions.push({
      id: "reconnect-channel",
      title: `Reconnect ${plural(connections.needsAttention, "channel")}`,
      reason: "An expired or revoked connection will make scheduled posts fail.",
      href: "/settings",
      cta: "Open settings",
      priority: "high",
      source: "setup",
    });
  }

  // Stable sort: high priority first, otherwise the order above.
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) =>
      a.action.priority === b.action.priority
        ? a.index - b.index
        : a.action.priority === "high"
          ? -1
          : 1
    )
    .map(({ action }) => action)
    .slice(0, MAX_DASHBOARD_ACTIONS);
}

/* =======================================================
   Entry point
======================================================= */

export function buildDashboardModel(sources: DashboardSources, now: Date = new Date()): DashboardModel {
  const brand = sources.brandProfile.ok ? sources.brandProfile.data : null;
  const answers = sources.onboarding.ok ? record(sources.onboarding.data?.answers) : null;

  const analysisJob = sources.websiteAnalysis.ok ? sources.websiteAnalysis.data : null;
  const analysisResult = analysisJob?.status === "completed" ? record(analysisJob.result) : null;

  const websiteAnalysis = buildWebsiteAnalysis(sources.websiteAnalysis, brand);
  // Matches onboarding completion: a low-confidence analysis is context, never
  // presented as a known fact about the business.
  const confidentAnalysis = analysisResult && analysisResult.confidence !== "low" ? analysisResult : null;
  const knowledge = buildKnowledge(
    sources.brandProfile,
    sources.onboarding,
    websiteAnalysis,
    confidentAnalysis
  );
  const campaigns = sources.campaigns.ok
    ? {
        status: "ready" as const,
        total: sources.campaigns.data.filter((row) => row.status !== "archived").length,
        active: sources.campaigns.data.filter((row) => row.status === "active").length,
      }
    : { status: "error" as const, total: 0, active: 0 };

  const base: Omit<DashboardModel, "loop" | "actions"> = {
    business: {
      name: knowledge.fields.find((field) => field.id === "name")?.value ?? null,
      industry:
        text(brand?.industry) ?? text(answers?.industry) ?? text(confidentAnalysis?.industry),
      website: text(brand?.website) ?? text(answers?.website_url) ?? analysisJob?.url ?? null,
      description: knowledge.fields.find((field) => field.id === "description")?.value ?? null,
    },
    knowledge,
    websiteAnalysis,
    strategy: buildStrategy(sources.strategies),
    execution: buildExecution(sources.posts, now),
    campaigns,
    publishing: buildPublishing(sources.publishLog, now),
    connections: buildConnections(sources.connections),
  };

  return { ...base, loop: buildLoop(base), actions: buildNextActions(base) };
}
