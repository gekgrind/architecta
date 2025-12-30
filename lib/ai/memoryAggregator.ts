// /lib/ai/memoryAggregator.ts

/* ======================================================
   Types
====================================================== */

export type MemoryEventType = "edit" | "refine" | "reject" | "accept";

export type MemoryDomain =
  | "tone"
  | "structure"
  | "length"
  | "cta"
  | "format"
  | "voice"
  | "style";

export type MemoryEvent = {
  type: MemoryEventType;
  domain: MemoryDomain;
  value: string;
  weight: number; // pre-scored (0–1+) from preferenceLearner / scorer
  timestamp: string; // ISO string
};

export type AggregatedPreference = {
  domain: MemoryDomain;
  dominantValue: string;
  confidence: number; // 0–1
  sampleSize: number;
  trend: "stable" | "emerging" | "volatile";
};

/* ======================================================
   Config
====================================================== */

const HALF_LIFE_DAYS = 30; // recency decay
const EMERGING_WINDOW_DAYS = 7;
const STABLE_THRESHOLD = 0.75;
const EMERGING_THRESHOLD = 0.6;

/* ======================================================
   Public API
====================================================== */

export function aggregateMemory(
  events: MemoryEvent[],
  now: Date = new Date()
): AggregatedPreference[] {
  if (!events.length) return [];

  const byDomain = groupByDomain(events);

  return Object.entries(byDomain).map(([domain, domainEvents]) =>
    aggregateDomain(domain as MemoryDomain, domainEvents, now)
  );
}

/* ======================================================
   Core Logic
====================================================== */

function aggregateDomain(
  domain: MemoryDomain,
  events: MemoryEvent[],
  now: Date
): AggregatedPreference {
  const weightedScores: Record<string, number> = {};
  let totalScore = 0;

  for (const event of events) {
    const decay = timeDecay(event.timestamp, now);
    const effectiveWeight = event.weight * decay;

    weightedScores[event.value] =
      (weightedScores[event.value] || 0) + effectiveWeight;

    totalScore += effectiveWeight;
  }

  const sorted = Object.entries(weightedScores).sort(
    (a, b) => b[1] - a[1]
  );

  const [dominantValue, dominantScore] = sorted[0];

  const confidence =
    totalScore > 0 ? clamp(dominantScore / totalScore) : 0;

  const trend = detectTrend(events, dominantValue, now);

  return {
    domain,
    dominantValue,
    confidence,
    sampleSize: events.length,
    trend,
  };
}

/* ======================================================
   Trend Detection
====================================================== */

function detectTrend(
  events: MemoryEvent[],
  dominantValue: string,
  now: Date
): "stable" | "emerging" | "volatile" {
  const recentCutoff = daysAgo(EMERGING_WINDOW_DAYS, now);

  const recent = events.filter(
    (e) => new Date(e.timestamp) >= recentCutoff
  );

  const recentMatches = recent.filter(
    (e) => e.value === dominantValue
  );

  const recentRatio =
    recent.length > 0 ? recentMatches.length / recent.length : 0;

  const overallMatches = events.filter(
    (e) => e.value === dominantValue
  ).length;

  const overallRatio = overallMatches / events.length;

  if (overallRatio >= STABLE_THRESHOLD) return "stable";

  if (
    recentRatio >= EMERGING_THRESHOLD &&
    recentRatio > overallRatio
  ) {
    return "emerging";
  }

  return "volatile";
}

/* ======================================================
   Utilities
====================================================== */

function groupByDomain(events: MemoryEvent[]) {
  return events.reduce<Record<MemoryDomain, MemoryEvent[]>>(
    (acc, event) => {
      acc[event.domain] ||= [];
      acc[event.domain].push(event);
      return acc;
    },
    {} as Record<MemoryDomain, MemoryEvent[]>
  );
}

function timeDecay(timestamp: string, now: Date) {
  const eventTime = new Date(timestamp).getTime();
  const ageDays =
    (now.getTime() - eventTime) / (1000 * 60 * 60 * 24);

  // exponential decay
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

function daysAgo(days: number, now: Date) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}
