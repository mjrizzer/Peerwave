import Link from "next/link";
import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { categories, type Session } from "@/lib/data";
import { SessionCard } from "@/components/sessions/card";
import { SetupNotice } from "@/components/setup-notice";
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const cats = await categories();
  const page = Math.max(1, Math.min(100, Number(p.page) || 1));
  let sessions: Session[] = [];
  let more = false;
  if (configured()) {
    const client = await db();
    let query = client
      .from("sessions")
      .select("*,categories(name),profiles!sessions_host_id_fkey(display_name)")
      .eq("visibility", "public")
      .eq("status", "published")
      .gt("ends_at", new Date().toISOString());
    const keyword = (p.q || "").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 100);
    if (keyword)
      query = query.or(
        `title.ilike.%${keyword}%,subject.ilike.%${keyword}%,tags.ilike.%${keyword}%`,
      );
    if (cats.some((c) => c.id === p.category))
      query = query.eq("category_id", p.category!);
    if (p.level) query = query.eq("difficulty", p.level);
    if (p.language) query = query.ilike("language", p.language.slice(0, 50));
    if (p.provider) query = query.eq("provider", p.provider);
    if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date))
      query = query
        .gte("starts_at", `${p.date}T00:00:00Z`)
        .lt("starts_at", `${p.date}T23:59:59Z`);
    query = query
      .order(p.sort === "recent" ? "created_at" : "starts_at", {
        ascending: p.sort !== "recent",
      })
      .range((page - 1) * 12, page * 12);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    more = (data?.length || 0) > 12;
    sessions = (data?.slice(0, 12) || []) as unknown as Session[];
  }
  const pageHref = (n: number) =>
    "/sessions?" +
    new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(p).filter(
          (e): e is [string, string] => typeof e[1] === "string",
        ),
      ),
      page: String(n),
    });
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">An open invitation to learn</div>
        <h1>
          Find your next <em>aha moment.</em>
        </h1>
        <p>Free sessions, led by people who were once exactly where you are.</p>
      </div>
      <form className="filters">
        <label className="field">
          What sparks your curiosity?
          <input
            name="q"
            defaultValue={p.q}
            placeholder="Try Python, interviews, public speaking…"
          />
        </label>
        <label className="field">
          Category
          <select name="category" defaultValue={p.category || ""}>
            <option value="">Every curiosity</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Level
          <select name="level" defaultValue={p.level || ""}>
            <option value="">All levels</option>
            {["Beginner", "Intermediate", "Advanced"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <button className="button">Find sessions ↗</button>
        <label className="field">
          Language
          <input
            name="language"
            defaultValue={p.language}
            placeholder="Any language"
          />
        </label>
        <label className="field">
          Platform
          <select name="provider" defaultValue={p.provider || ""}>
            <option value="">All platforms</option>
            {["Google Meet", "Zoom", "Microsoft Teams"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Date (UTC)
          <input name="date" type="date" defaultValue={p.date} />
        </label>
        <label className="field">
          Sort
          <select name="sort" defaultValue={p.sort || "upcoming"}>
            <option value="upcoming">Upcoming first</option>
            <option value="recent">Recently published</option>
          </select>
        </label>
      </form>
      <Link className="text-link" href="/sessions">
        Clear filters
      </Link>
      {!configured() ? (
        <SetupNotice />
      ) : (
        <div style={{ marginTop: 28 }}>
          {sessions.length ? (
            <div className="grid-3">
              {sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>No sessions just yet.</h3>
              <p>
                Try a broader search, or ask the community for the topic you
                have in mind.
              </p>
              <Link className="button button-outline" href="/requests/new">
                Request a topic ↗
              </Link>
            </div>
          )}
          <nav className="page-number" aria-label="Pagination">
            {page > 1 && <Link href={pageHref(page - 1)}>← Previous</Link>}
            {more && <Link href={pageHref(page + 1)}>Next →</Link>}
          </nav>
        </div>
      )}
    </div>
  );
}
