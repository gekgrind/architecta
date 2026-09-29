/**
 * Canonical strategy records.
 *
 * One mapping from a persisted `architecta_content_strategies` row (or any
 * subset of it) to the typed shape every consumer reads, plus the single
 * definition of which strategy is the business's current strategy.
 *
 * Pure and client-safe: no database access, no server-only imports.
 */

export const STRATEGY_KINDS = [
  "content_strategy",
  "content_architect",
  "strategy_engine",
  "custom",
] as const;
export type StrategyRecordKind = (typeof STRATEGY_KINDS)[number];

export const STRATEGY_STATUSES = ["draft", "active", "archived"] as const;
export type StrategyRecordStatus = (typeof STRATEGY_STATUSES)[number];

/**
 * Kinds that can represent the business's strategic direction. Content
 * Strategy and Content Architect outputs are content planning artifacts and
 * never qualify as the current strategy.
 */
export const BUSINESS_STRATEGY_KINDS = ["strategy_engine", "custom"] as const satisfies readonly StrategyRecordKind[];

export function isBusinessStrategyKind(kind: unknown): boolean {
  return (BUSINESS_STRATEGY_KINDS as readonly unknown[]).includes(kind);
}

export type StrategyRecordPillar = {
  id: string;
  title: string;
  description: string;
  items: string[];
};

export type StrategyRecord = {
  id: string;
  kind: StrategyRecordKind;
  title: string | null;
  status: StrategyRecordStatus;
  summary: string | null;
  pillars: StrategyRecordPillar[];
  audienceAngles: string[];
  contentThemes: string[];
  postingCadence: string[];
  quickWins: string[];
  nextActions: string[];
  growthPriorities: string[];
  thirtyDayFocus: string[];
  campaignsSeed: unknown[];
  platformStrategy: Record<string, unknown>;
  sourceInput: Record<string, unknown>;
  aiProvider: string | null;
  aiModel: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asText).filter((entry): entry is string => entry !== null);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Stable identifier for a pillar persisted without one. Strategy id + array
 * position is unique on its own; the title slug keeps ids readable. Derived
 * from stored data only, so every read of the same row yields the same ids.
 */
export function derivePillarId(strategyId: string, index: number, title: string): string {
  const slug = slugify(title);
  return `${strategyId}:p${index}${slug ? `:${slug}` : ""}`;
}

/**
 * Normalizes current (`items`) and historical (`moves`) pillar shapes.
 * Entries without a title are skipped; the original array position is used
 * for derived ids so a malformed sibling never shifts another pillar's id.
 */
export function normalizePillars(strategyId: string, value: unknown): StrategyRecordPillar[] {
  if (!Array.isArray(value)) return [];
  const out: StrategyRecordPillar[] = [];
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const pillar = asRecord(entry);
    const title = asText(pillar?.title);
    if (!pillar || !title) return;
    const persistedId = asText(pillar.id);
    let id = persistedId && !seen.has(persistedId) ? persistedId : derivePillarId(strategyId, index, title);
    if (seen.has(id)) id = `${strategyId}:p${index}`;
    seen.add(id);
    out.push({
      id,
      title,
      description: asText(pillar.description) ?? "",
      items: asStrings(pillar.items ?? pillar.moves),
    });
  });
  return out;
}

function asKind(value: unknown): StrategyRecordKind {
  return (STRATEGY_KINDS as readonly unknown[]).includes(value)
    ? (value as StrategyRecordKind)
    : "content_strategy";
}

function asStatus(value: unknown): StrategyRecordStatus {
  // Unknown statuses read as draft: never promote malformed data to active.
  return (STRATEGY_STATUSES as readonly unknown[]).includes(value)
    ? (value as StrategyRecordStatus)
    : "draft";
}

/** Maps a persisted strategy row (or a subset of its columns) to the canonical record. */
export function normalizeStrategyRecord(row: unknown): StrategyRecord {
  const r = asRecord(row) ?? {};
  const id = typeof r.id === "string" ? r.id : "";
  const meta = asRecord(r.meta) ?? {};
  const createdAt = typeof r.created_at === "string" ? r.created_at : "";

  return {
    id,
    kind: asKind(r.kind),
    title: asText(r.title),
    status: asStatus(r.status),
    summary: asText(r.summary),
    pillars: normalizePillars(id, r.pillars),
    audienceAngles: asStrings(r.audience_angles),
    contentThemes: asStrings(r.content_themes),
    postingCadence: asStrings(r.posting_cadence),
    quickWins: asStrings(r.quick_wins),
    nextActions: asStrings(r.next_actions),
    growthPriorities: asStrings(meta.growthPriorities),
    thirtyDayFocus: asStrings(meta.thirtyDayFocus),
    campaignsSeed: Array.isArray(r.campaigns_seed) ? r.campaigns_seed : [],
    platformStrategy: asRecord(r.platform_strategy) ?? {},
    sourceInput: asRecord(r.source_input) ?? {},
    aiProvider: asText(r.ai_provider),
    aiModel: asText(r.ai_model),
    meta,
    createdAt,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : createdAt,
  };
}

export type CurrentStrategy = {
  record: StrategyRecord;
  /** True only for an explicitly activated strategy; false for the latest-draft fallback. */
  isActive: boolean;
};

function newestFirst(a: StrategyRecord, b: StrategyRecord): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** Non-archived strategies of an eligible kind, newest first. */
export function eligibleStrategies(records: StrategyRecord[]): StrategyRecord[] {
  return records
    .filter((record) => record.status !== "archived" && isBusinessStrategyKind(record.kind))
    .sort(newestFirst);
}

/**
 * The business's current strategy: an eligible `active` strategy wins
 * (newest, if legacy data holds several); otherwise the newest eligible draft
 * is returned as a fallback view that is never reported as active.
 */
export function selectCurrentStrategy(records: StrategyRecord[]): CurrentStrategy | null {
  const eligible = eligibleStrategies(records);
  const active = eligible.find((record) => record.status === "active");
  if (active) return { record: active, isActive: true };
  const draft = eligible.find((record) => record.status === "draft");
  return draft ? { record: draft, isActive: false } : null;
}

/* =======================================================
   Generated output integrity
======================================================= */

/** Title `parseStrategyResponse` substitutes when the model omitted one — not generated content. */
export const PARSER_PLACEHOLDER_PILLAR_TITLE = "Untitled pillar";

export const MIN_STRATEGY_SUMMARY_LENGTH = 20;

export type GeneratedPillarInput = { title?: unknown; description?: unknown; items?: unknown };

/** A pillar with a real title and at least a description or one item. */
export function isUsableGeneratedPillar(pillar: GeneratedPillarInput): boolean {
  const title = typeof pillar.title === "string" ? pillar.title.trim() : "";
  if (!title || title === PARSER_PLACEHOLDER_PILLAR_TITLE) return false;
  const description = typeof pillar.description === "string" ? pillar.description.trim() : "";
  return description.length > 0 || asStrings(pillar.items).length > 0;
}

export type GeneratedStrategyIssue = "missing_summary" | "no_usable_pillars";

/** Minimum bar a generated business strategy must clear before it is persisted. */
export function generatedStrategyIssues(generated: {
  summary: unknown;
  contentPillars: GeneratedPillarInput[];
}): GeneratedStrategyIssue[] {
  const issues: GeneratedStrategyIssue[] = [];
  const summary = typeof generated.summary === "string" ? generated.summary.trim() : "";
  if (summary.length < MIN_STRATEGY_SUMMARY_LENGTH) issues.push("missing_summary");
  if (!generated.contentPillars.some(isUsableGeneratedPillar)) issues.push("no_usable_pillars");
  return issues;
}
