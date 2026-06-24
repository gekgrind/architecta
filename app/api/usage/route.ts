import { apiError, apiOk } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type UsageRow = {
  task: string;
  tier: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number | string | null;
  used_fallback: boolean;
  created_at: string;
};

function num(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { searchParams } = new URL(req.url);
  const rawDays = Number.parseInt(searchParams.get("days") ?? "30", 10);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("architecta_llm_usage")
    .select(
      "task, tier, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, used_fallback, created_at"
    )
    .eq("user_id", session.user.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return apiError("server_error", error.message);

  const rows = (data ?? []) as UsageRow[];

  const totals = {
    calls: rows.length,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    fallbackCalls: 0,
  };

  const byProvider = new Map<string, { calls: number; totalTokens: number; costUsd: number }>();
  const byModel = new Map<string, { provider: string; calls: number; totalTokens: number; costUsd: number }>();
  const byTask = new Map<string, { calls: number; totalTokens: number; costUsd: number }>();
  const byDay = new Map<string, { calls: number; totalTokens: number; costUsd: number }>();

  for (const row of rows) {
    const cost = num(row.cost_usd);
    const total = num(row.total_tokens) || num(row.input_tokens) + num(row.output_tokens);

    totals.inputTokens += num(row.input_tokens);
    totals.outputTokens += num(row.output_tokens);
    totals.totalTokens += total;
    totals.costUsd += cost;
    if (row.used_fallback) totals.fallbackCalls += 1;

    const prov = byProvider.get(row.provider) ?? { calls: 0, totalTokens: 0, costUsd: 0 };
    prov.calls += 1;
    prov.totalTokens += total;
    prov.costUsd += cost;
    byProvider.set(row.provider, prov);

    const modelKey = `${row.provider}:${row.model}`;
    const model = byModel.get(modelKey) ?? {
      provider: row.provider,
      calls: 0,
      totalTokens: 0,
      costUsd: 0,
    };
    model.calls += 1;
    model.totalTokens += total;
    model.costUsd += cost;
    byModel.set(modelKey, model);

    const task = byTask.get(row.task) ?? { calls: 0, totalTokens: 0, costUsd: 0 };
    task.calls += 1;
    task.totalTokens += total;
    task.costUsd += cost;
    byTask.set(row.task, task);

    const dk = dayKey(row.created_at);
    const day = byDay.get(dk) ?? { calls: 0, totalTokens: 0, costUsd: 0 };
    day.calls += 1;
    day.totalTokens += total;
    day.costUsd += cost;
    byDay.set(dk, day);
  }

  const round = (n: number) => Number(n.toFixed(5));

  return apiOk({
    windowDays: days,
    since,
    totals: {
      ...totals,
      costUsd: round(totals.costUsd),
    },
    byProvider: Array.from(byProvider.entries())
      .map(([provider, v]) => ({ provider, ...v, costUsd: round(v.costUsd) }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
    byModel: Array.from(byModel.entries())
      .map(([key, v]) => ({ model: key.split(":").slice(1).join(":"), ...v, costUsd: round(v.costUsd) }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
    byTask: Array.from(byTask.entries())
      .map(([task, v]) => ({ task, ...v, costUsd: round(v.costUsd) }))
      .sort((a, b) => b.calls - a.calls),
    daily: Array.from(byDay.entries())
      .map(([date, v]) => ({ date, ...v, costUsd: round(v.costUsd) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
}
