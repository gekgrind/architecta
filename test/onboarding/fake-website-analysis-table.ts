/**
 * In-memory double of the architecta_website_analyses table that actually
 * evaluates PostgREST-style filters, so claim/fence/stale semantics (which
 * depend on conditional updates) can be tested without a database.
 *
 * Supports: select(cols) / insert / update, eq / lt / lte / gte, order,
 * limit, single / maybeSingle, and `.select()` after a write to return the
 * affected rows. Enforces unique(session_id) with Postgres error 23505.
 */

export type JobRow = Record<string, unknown> & { id: string; session_id: string };

type Filter = { column: string; op: "eq" | "lt" | "lte" | "gte"; value: unknown };

const TABLE = "architecta_website_analyses";

function compare(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const ta = typeof a === "string" ? Date.parse(a) : NaN;
  const tb = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
  return String(a).localeCompare(String(b));
}

function matches(row: JobRow, filters: Filter[]): boolean {
  return filters.every(({ column, op, value }) => {
    const actual = row[column];
    if (op === "eq") return actual === value;
    if (actual === null || actual === undefined) return false;
    const c = compare(actual, value);
    if (op === "lt") return c < 0;
    if (op === "lte") return c <= 0;
    return c >= 0;
  });
}

function pick(row: JobRow, columns?: string): Record<string, unknown> {
  if (!columns || columns.trim() === "*") return { ...row };
  const out: Record<string, unknown> = {};
  for (const col of columns.split(",").map((c) => c.trim())) out[col] = row[col];
  return out;
}

export function createFakeWebsiteAnalysisTable(seed: JobRow[] = []) {
  const rows = new Map<string, JobRow>(seed.map((r) => [r.id, { ...r }]));
  let nextId = 1;
  const writes: Array<{ op: "insert" | "update"; payload: Record<string, unknown>; affected: number }> = [];

  function from(table: string) {
    if (table !== TABLE) throw new Error(`fake table does not handle ${table}`);

    let op: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> = {};
    let columns: string | undefined;
    let returning = false;
    const filters: Filter[] = [];
    let orderBy: { column: string; ascending: boolean } | null = null;
    let limit: number | null = null;

    function run(): { data: unknown; error: unknown } {
      if (op === "insert") {
        const sessionId = payload.session_id as string;
        if ([...rows.values()].some((r) => r.session_id === sessionId)) {
          return { data: null, error: { code: "23505", message: "duplicate key value" } };
        }
        const now = new Date().toISOString();
        const row: JobRow = {
          id: `job-${nextId++}`,
          attempts: 0,
          status: "queued",
          next_attempt_at: now,
          claimed_at: null,
          claim_token: null,
          completed_at: null,
          error_code: null,
          result: null,
          model: null,
          evidence: null,
          created_at: now,
          updated_at: now,
          ...(payload as Partial<JobRow>),
          session_id: sessionId,
        };
        rows.set(row.id, row);
        writes.push({ op, payload, affected: 1 });
        return { data: [pick(row, columns)], error: null };
      }

      let matched = [...rows.values()].filter((r) => matches(r, filters));

      if (op === "update") {
        for (const r of matched) Object.assign(r, payload, { updated_at: new Date().toISOString() });
        writes.push({ op, payload, affected: matched.length });
        return { data: returning ? matched.map((r) => pick(r, columns)) : null, error: null };
      }

      if (orderBy) {
        const { column, ascending } = orderBy;
        matched = matched.sort((a, b) => compare(a[column], b[column]) * (ascending ? 1 : -1));
      }
      if (limit !== null) matched = matched.slice(0, limit);
      return { data: matched.map((r) => pick(r, columns)), error: null };
    }

    function single(allowEmpty: boolean) {
      const { data, error } = run();
      if (error) return Promise.resolve({ data: null, error });
      const list = (data as unknown[] | null) ?? [];
      if (list.length === 0) {
        return Promise.resolve(
          allowEmpty ? { data: null, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } }
        );
      }
      return Promise.resolve({ data: list[0], error: null });
    }

    const chain = {
      select(cols?: string) {
        if (op === "select") columns = cols;
        else {
          returning = true;
          columns = cols;
        }
        return chain;
      },
      insert(values: Record<string, unknown>) {
        op = "insert";
        payload = values;
        return chain;
      },
      update(values: Record<string, unknown>) {
        op = "update";
        payload = values;
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push({ column, op: "eq", value });
        return chain;
      },
      lt(column: string, value: unknown) {
        filters.push({ column, op: "lt", value });
        return chain;
      },
      lte(column: string, value: unknown) {
        filters.push({ column, op: "lte", value });
        return chain;
      },
      gte(column: string, value: unknown) {
        filters.push({ column, op: "gte", value });
        return chain;
      },
      order(column: string, opts: { ascending?: boolean } = {}) {
        orderBy = { column, ascending: opts.ascending !== false };
        return chain;
      },
      limit(n: number) {
        limit = n;
        return chain;
      },
      single: () => single(false),
      maybeSingle: () => single(true),
      then<T>(onFulfilled: (value: { data: unknown; error: unknown }) => T, onRejected?: (reason: unknown) => T) {
        return Promise.resolve(run()).then(onFulfilled, onRejected);
      },
    };
    return chain;
  }

  return {
    client: { from } as unknown as import("@supabase/supabase-js").SupabaseClient,
    from,
    rows,
    writes,
    only(): JobRow {
      const all = [...rows.values()];
      if (all.length !== 1) throw new Error(`expected exactly one job, found ${all.length}`);
      return all[0];
    },
  };
}
