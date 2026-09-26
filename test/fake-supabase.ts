/**
 * In-memory Supabase/PostgREST fake for route-level lifecycle tests.
 *
 * Filters, conditional UPDATE … RETURNING, insert/delete, order/limit and
 * single/maybeSingle behave like the real client, so multi-step route logic
 * (and the publish worker's atomic claim) can be exercised end to end.
 * `failWhen(table, op, values)` injects a database error for one operation.
 */

type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update" | "delete";
type Result = { data: unknown; error: { message: string; code?: string } | null };

export type FakeOp = { table: string; op: Op; values: Row };

export function makeFakeSupabase(
  seed: Record<string, Row[]>,
  failWhen: (table: string, op: Op, values: Row) => boolean = () => false
) {
  const tables: Record<string, Row[]> = { ...seed };
  const log: FakeOp[] = [];
  let nextId = 1;

  function from(table: string) {
    tables[table] ??= [];
    const filters: Array<(r: Row) => boolean> = [];
    let op: Op = "select";
    let values: Row = {};
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let mode: "many" | "single" | "maybeSingle" = "many";

    const run = (): Result => {
      log.push({ table, op, values });
      if (failWhen(table, op, values)) return { data: null, error: { message: "db down" } };

      let rows: Row[];
      if (op === "insert") {
        const row = {
          id: `gen-${nextId++}`,
          created_at: new Date().toISOString(),
          ...values,
        };
        tables[table].push(row);
        rows = [row];
      } else {
        rows = tables[table].filter((r) => filters.every((f) => f(r)));
        if (op === "update") rows.forEach((r) => Object.assign(r, values));
        if (op === "delete") tables[table] = tables[table].filter((r) => !rows.includes(r));
        if (order) {
          const { col, asc } = order;
          rows = [...rows].sort((a, b) =>
            String(a[col]) < String(b[col]) ? (asc ? -1 : 1) : asc ? 1 : -1
          );
        }
        if (limit !== null) rows = rows.slice(0, limit);
      }
      const copies = rows.map((r) => ({ ...r }));

      if (mode === "many") return { data: copies, error: null };
      if (copies.length > 1 || (mode === "single" && copies.length === 0)) {
        return {
          data: null,
          error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" },
        };
      }
      return { data: copies[0] ?? null, error: null };
    };

    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      insert: (v: Row) => ((op = "insert"), (values = v), q),
      update: (v: Row) => ((op = "update"), (values = v), q),
      delete: () => ((op = "delete"), q),
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      lt: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) < v), q),
      lte: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) <= v), q),
      gte: (c: string, v: string) => (filters.push((r) => r[c] != null && String(r[c]) >= v), q),
      order: (col: string, opts?: { ascending?: boolean }) => (
        (order = { col, asc: opts?.ascending !== false }), q
      ),
      limit: (n: number) => ((limit = n), q),
      single: () => ((mode = "single"), Promise.resolve(run())),
      maybeSingle: () => ((mode = "maybeSingle"), Promise.resolve(run())),
      then: (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(f, r),
    });
    return q;
  }

  return { client: { from } as never, tables, log };
}
