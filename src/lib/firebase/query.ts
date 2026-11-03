import { Store, canRead, type Actor, type Row } from "./store";
type Filter = { field: string; op: string; value: unknown };
export class Query {
  private fields = "*";
  private filters: Filter[] = [];
  private sorts: { field: string; asc: boolean }[] = [];
  private start = 0;
  private end = 999;
  private shape = "many";
  private head = false;
  constructor(
    private table: string,
    private actor: Actor,
  ) {}
  select(fields = "*", options?: { count?: string; head?: boolean }) {
    this.fields = fields;
    this.head = !!options?.head;
    return this;
  }
  eq(field: string, value: unknown) {
    this.filters.push({ field, op: "eq", value });
    return this;
  }
  neq(field: string, value: unknown) {
    this.filters.push({ field, op: "neq", value });
    return this;
  }
  gt(field: string, value: unknown) {
    this.filters.push({ field, op: "gt", value });
    return this;
  }
  gte(field: string, value: unknown) {
    this.filters.push({ field, op: "gte", value });
    return this;
  }
  lt(field: string, value: unknown) {
    this.filters.push({ field, op: "lt", value });
    return this;
  }
  is(field: string, value: unknown) {
    return this.eq(field, value);
  }
  ilike(field: string, value: string) {
    this.filters.push({ field, op: "ilike", value });
    return this;
  }
  or(value: string) {
    this.filters.push({ field: "", op: "or", value });
    return this;
  }
  order(field: string, options?: { ascending?: boolean }) {
    this.sorts.push({ field, asc: options?.ascending !== false });
    return this;
  }
  limit(count: number) {
    this.end = this.start + count - 1;
    return this;
  }
  range(start: number, end: number) {
    this.start = start;
    this.end = end;
    return this;
  }
  single() {
    this.shape = "single";
    return this;
  }
  maybeSingle() {
    this.shape = "maybe";
    return this;
  }
  async execute(): Promise<{
    data: Row[] & Row;
    error: { message: string; code?: string } | null;
    count: number;
  }> {
    try {
      const store = new Store();
      const first = this.filters.find(
        (f) => f.op === "eq" && !f.field.includes("."),
      );
      let rows: Row[];
      if (first?.field === "id") {
        const row = await store.get(this.table, String(first.value));
        rows = row ? [row] : [];
      } else rows = await store.list(this.table, first?.field, first?.value);
      const visible: Row[] = [];
      for (const row of rows)
        if (await canRead(store, this.actor, this.table, row))
          visible.push(await this.expand(store, row));
      rows = visible.filter((row) =>
        this.filters.every((f) => {
          const val = f.field.split(".").reduce((v, k) => v?.[k], row);
          const v = f.value;
          switch (f.op) {
            case "eq":
              return val === v || (v === null && val == null);
            case "neq":
              return val !== v;
            case "gt":
              return val > v!;
            case "gte":
              return val >= v!;
            case "lt":
              return val < v!;
            case "ilike":
              return String(val)
                .toLowerCase()
                .includes(String(v).replaceAll("%", "").toLowerCase());
            case "or":
              return String(v)
                .split(",")
                .some((t) => {
                  const [field, , ...term] = t.split(".");
                  return String(row[field])
                    .toLowerCase()
                    .includes(term.join(".").replaceAll("%", "").toLowerCase());
                });
            default:
              return false;
          }
        }),
      );
      for (const sort of [...this.sorts].reverse())
        rows.sort(
          (a, b) =>
            (a[sort.field] > b[sort.field]
              ? 1
              : a[sort.field] < b[sort.field]
                ? -1
                : 0) * (sort.asc ? 1 : -1),
        );
      const count = rows.length;
      rows = rows.slice(this.start, this.end + 1);
      if (this.shape === "single" && !rows.length)
        throw new Error("Record not found");
      const data = this.head
        ? null
        : this.shape === "many"
          ? rows
          : rows[0] || null;
      return { data: data as Row[] & Row, error: null, count };
    } catch (e) {
      return {
        data: null as unknown as Row[] & Row,
        error: {
          message: e instanceof Error ? e.message : "Unable to load data",
        },
        count: 0,
      };
    }
  }
  then<TResult1 = Awaited<ReturnType<Query["execute"]>>, TResult2 = never>(
    resolve?:
      | ((
          value: Awaited<ReturnType<Query["execute"]>>,
        ) => TResult1 | PromiseLike<TResult1>)
      | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(resolve, reject);
  }
  private async expand(store: Store, row: Row) {
    const out = { ...row };
    const add = async (name: string, table: string, id: string) => {
      const r = await store.get(table, id);
      out[name] = r && (await canRead(store, this.actor, table, r)) ? r : null;
    };
    if (this.fields.includes("profiles(") || this.fields.includes("profiles!"))
      await add(
        "profiles",
        "profiles",
        row.host_id || row.creator_id || row.user_id || row.owner_id,
      );
    if (this.fields.includes("categories("))
      await add("categories", "categories", row.category_id);
    if (this.fields.includes("sessions(") || this.fields.includes("sessions!"))
      await add("sessions", "sessions", row.session_id);
    if (this.fields.includes("study_circles("))
      await add("study_circles", "study_circles", row.circle_id);
    for (const [name, field] of [
      ["request_interests", "request_id"],
      ["question_votes", "question_id"],
      ["message_reactions", "message_id"],
    ])
      if (this.fields.includes(name + "(")) {
        out[name] = [];
        for (const r of await store.list(name, field, row.id))
          if (await canRead(store, this.actor, name, r)) out[name].push(r);
      }
    return out;
  }
}
