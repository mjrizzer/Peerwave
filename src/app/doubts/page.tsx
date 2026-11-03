import Link from "next/link";
import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { SetupNotice } from "@/components/setup-notice";
import { Realtime } from "@/components/realtime";
export default async function Doubts() {
  let rows: {
    id: string;
    topic: string;
    description: string;
    status: string;
    expires_at: string;
    urgency: string;
    expected_minutes: number;
    language: string;
  }[] = [];
  if (configured()) {
    const client = await db();
    const { data, error } = await client
      .from("instant_doubt_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    rows = (data || []) as unknown as typeof rows;
  }
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">A small question. A shared breakthrough.</div>
        <h1>
          Stuck? <em>Let’s untangle it.</em>
        </h1>
        <p>
          Ask for a little help, or offer a little of your time. Requests aren’t
          a guarantee that someone is currently available.
        </p>
        <Link className="button" href="/doubts/new">
          Ask for help ↗
        </Link>
      </div>
      {configured() ? (
        <Realtime table="instant_doubt_requests" />
      ) : (
        <SetupNotice />
      )}
      <div className="grid-2" style={{ marginTop: 25 }}>
        {rows.map((r) => (
          <Link className="panel" href={`/doubts/${r.id}`} key={r.id}>
            <span className="badge">
              {r.status === "pending" && new Date(r.expires_at) < new Date()
                ? "expired"
                : r.status}
            </span>
            <h3 style={{ marginTop: 18 }}>{r.topic}</h3>
            <p className="muted">{r.description.slice(0, 180)}</p>
            <span className="subtle">
              {r.urgency} · About {r.expected_minutes} min · {r.language}
            </span>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <div className="empty">
          <h3>No one should have to figure it all out alone.</h3>
          <p>
            Post your first question, or check back to help a fellow learner.
          </p>
        </div>
      )}
    </div>
  );
}
