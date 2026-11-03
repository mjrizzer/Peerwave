import Link from "next/link";
import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { SetupNotice } from "@/components/setup-notice";
export default async function Requests() {
  let rows: {
    id: string;
    topic: string;
    description: string;
    language: string;
    session_id: string | null;
    request_interests: { user_id: string }[];
  }[] = [];
  if (configured()) {
    const client = await db();
    const { data, error } = await client
      .from("session_requests")
      .select(
        "id,topic,description,language,session_id,request_interests(user_id)",
      )
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    rows = (data || []) as unknown as typeof rows;
  }
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">The community sets the curriculum</div>
        <h1>
          You’re not the only one <em>wondering.</em>
        </h1>
        <p>
          Ask for a workshop. Find people who want it too. Help a generous mind
          turn it into a session.
        </p>
        <Link className="button" href="/requests/new">
          Request a topic ↗
        </Link>
      </div>
      {!configured() && <SetupNotice />}
      <div className="grid-2">
        {rows.map((r) => (
          <Link className="panel" key={r.id} href={`/requests/${r.id}`}>
            <span className="badge">
              {r.session_id ? "Session scheduled" : "Looking for a host"}
            </span>
            <h3 style={{ marginTop: 20 }}>{r.topic}</h3>
            <p className="muted">{r.description.slice(0, 180)}</p>
            <span className="text-link">
              {r.request_interests.length} curious learners · {r.language} ↗
            </span>
          </Link>
        ))}
      </div>
      {!rows.length && (
        <div className="empty">
          <h3>Your curiosity could start something.</h3>
          <p>Be the first to request a topic.</p>
        </div>
      )}
    </div>
  );
}
