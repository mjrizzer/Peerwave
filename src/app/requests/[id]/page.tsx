import Link from "next/link";
import { notFound } from "next/navigation";
import { db, currentUser } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { ActionForm } from "@/components/action-form";
export default async function Request({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!configured()) notFound();
  const { id } = await params;
  const client = await db();
  const user = await currentUser();
  const { data: r } = await client
    .from("session_requests")
    .select(
      "*,profiles(display_name),categories(name),request_interests(user_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();
  const { data: proposals } = await client
    .from("host_proposals")
    .select("*,profiles(display_name)")
    .eq("request_id", id);
  const accepted = proposals?.find((p) => p.status === "accepted");
  const { data: sessions } = user
    ? await client
        .from("sessions")
        .select("id,title")
        .eq("host_id", user.id)
        .eq("status", "published")
        .eq("visibility", "public")
    : { data: [] };
  return (
    <div className="page-content">
      <div className="page-head">
        <Link className="text-link" href="/requests">
          ← Request board
        </Link>
        <div className="eyebrow" style={{ marginTop: 25 }}>
          {r.categories?.name}
        </div>
        <h1>{r.topic}</h1>
        <p>
          Requested by {r.profiles?.display_name} · {r.difficulty} ·{" "}
          {r.language}
        </p>
      </div>
      <div className="detail-layout">
        <div className="panel">
          <p className="detail-copy">{r.description}</p>
          <p className="muted">
            Preferred schedule: {r.preferred_schedule || "Flexible"}
          </p>
          <h3>{r.request_interests.length} learners are curious too.</h3>
          {user ? (
            <ActionForm
              action="interest"
              payload={{ id }}
              label={
                r.request_interests.some(
                  (v: { user_id: string }) => v.user_id === user.id,
                )
                  ? "Remove my interest"
                  : "I’d love to learn this"
              }
            />
          ) : (
            <Link className="button" href="/auth/login">
              Sign in to express interest
            </Link>
          )}
          {r.session_id && (
            <div className="notice">
              This idea became a session!{" "}
              <Link className="text-link" href={`/sessions/${r.session_id}`}>
                View the workshop ↗
              </Link>
            </div>
          )}
          <h3 style={{ marginTop: 35 }}>Offers to teach</h3>
          {proposals?.map((p) => (
            <div className="list-row" key={p.id}>
              <Link href={`/people/${p.host_id}`}>
                {p.profiles?.display_name}
              </Link>{" "}
              <span className="badge">{p.status}</span>
              <p>{p.note}</p>
              {user?.id === r.creator_id &&
                !accepted &&
                p.status === "pending" && (
                  <ActionForm
                    action="accept_proposal"
                    payload={{ id: p.id }}
                    label="Choose this host"
                  />
                )}
            </div>
          ))}
        </div>
        <aside className="panel">
          <h3>Know a little about this?</h3>
          <p className="muted">You could be the person who helps it click.</p>
          {user && !accepted && (
            <ActionForm action="propose" payload={{ id }} label="Offer to host">
              <label className="field">
                What would you cover?
                <textarea name="body" minLength={5} maxLength={1000} required />
              </label>
            </ActionForm>
          )}
          {!user && (
            <Link href="/auth/login" className="text-link">
              Sign in to offer your help ↗
            </Link>
          )}
          {accepted?.host_id === user?.id && !r.session_id && (
            <>
              <p>
                Your offer was accepted. Create your session, then link it here.
              </p>
              <Link className="button button-outline" href="/host">
                Create session
              </Link>
              <ActionForm
                action="link_request"
                payload={{ id }}
                label="Link published session"
              >
                <label className="field">
                  Your public sessions
                  <select name="session_id" required>
                    {sessions?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
