import Link from "next/link";
import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { SetupNotice } from "@/components/setup-notice";
export default async function Circles() {
  let rows: {
    id: string;
    title: string;
    description: string;
    membership_mode: string;
  }[] = [];
  if (configured()) {
    const client = await db();
    const { data, error } = await client
      .from("study_circles")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    rows = (data || []) as unknown as typeof rows;
  }
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">Learning is better with familiar faces</div>
        <h1>
          Find your <em>little circle.</em>
        </h1>
        <p>
          A shared goal, a regular conversation, and people who keep showing up.
        </p>
        <Link className="button" href="/circles/new">
          Start a study circle ↗
        </Link>
      </div>
      {!configured() && <SetupNotice />}
      <div className="grid-3">
        {rows.map((c) => (
          <Link href={`/circles/${c.id}`} key={c.id} className="panel">
            <span className="badge">
              {c.membership_mode === "open"
                ? "Open membership"
                : "Membership approval"}
            </span>
            <h3 style={{ marginTop: 20 }}>{c.title}</h3>
            <p className="muted">{c.description.slice(0, 180)}</p>
            <span className="text-link">Meet the circle ↗</span>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <div className="empty">
          <h3>Someone has to pull up the first chair.</h3>
          <p>Start a circle around the thing you want to learn together.</p>
        </div>
      )}
    </div>
  );
}
