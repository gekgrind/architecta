/**
 * Minimal table-aware Supabase client double for onboarding tests.
 *
 * Every `from(table)` chain is recorded (operation, payload, eq filters) and
 * resolves — whether awaited directly or via single()/maybeSingle() — to the
 * result configured for that table + operation. Unconfigured reads resolve
 * to `{ data: null, error: null }`.
 */

type Op = "select" | "insert" | "update" | "upsert";

export type QueryResult = { data: unknown; error: unknown };

export type RecordedQuery = {
  table: string;
  op: Op;
  payload?: Record<string, unknown>;
  columns?: string;
  filters: Record<string, unknown>;
};

type TableConfig = Partial<Record<Op, QueryResult | ((q: RecordedQuery) => QueryResult)>>;

export function createSupabaseRecorder(options: {
  userId: string | null;
  tables?: Record<string, TableConfig>;
}) {
  const queries: RecordedQuery[] = [];

  function resolve(query: RecordedQuery): QueryResult {
    const configured = options.tables?.[query.table]?.[query.op];
    if (!configured) return { data: null, error: null };
    return typeof configured === "function" ? configured(query) : configured;
  }

  function from(table: string) {
    const query: RecordedQuery = { table, op: "select", filters: {} };
    queries.push(query);

    const chain = {
      select(columns?: string) {
        // select() after a write only shapes the returned rows.
        if (query.op === "select") query.columns = columns;
        return chain;
      },
      insert(payload: Record<string, unknown>) {
        query.op = "insert";
        query.payload = payload;
        return chain;
      },
      update(payload: Record<string, unknown>) {
        query.op = "update";
        query.payload = payload;
        return chain;
      },
      upsert(payload: Record<string, unknown>) {
        query.op = "upsert";
        query.payload = payload;
        return chain;
      },
      eq(column: string, value: unknown) {
        query.filters[column] = value;
        return chain;
      },
      single: () => Promise.resolve(resolve(query)),
      maybeSingle: () => Promise.resolve(resolve(query)),
      then<T>(onFulfilled: (value: QueryResult) => T, onRejected?: (reason: unknown) => T) {
        return Promise.resolve(resolve(query)).then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  const client = {
    from,
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: options.userId ? { id: options.userId } : null },
          error: null,
        }),
    },
  };

  return {
    client,
    queries,
    writesTo(table: string) {
      return queries.filter((q) => q.table === table && q.op !== "select");
    },
  };
}
