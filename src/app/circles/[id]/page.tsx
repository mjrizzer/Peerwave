import Link from "next/link";
import { notFound } from "next/navigation";
import { db, currentUser } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { type Session } from "@/lib/data";
import { ActionForm } from "@/components/action-form";
import { Realtime } from "@/components/realtime";
import { LocalTime } from "@/components/local-time";
import { Report } from "@/components/report";
import { SessionCard } from "@/components/sessions/card";
export default async function Circle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!configured()) notFound();
  const { id } = await params;
  const client = await db();
  const user = await currentUser();
  const { data: c } = await client
    .from("study_circles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const { data: membership } = user
    ? await client
        .from("circle_memberships")
        .select("*")
        .eq("circle_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const member = c.owner_id === user?.id || membership?.status === "approved";
  const manager =
    c.owner_id === user?.id ||
    (membership?.status === "approved" && membership?.role === "moderator");
  const { data: posts } = member
    ? await client
        .from("circle_posts")
        .select("*,profiles(display_name)")
        .eq("circle_id", id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const { data: members } = member
    ? await client
        .from("circle_memberships")
        .select("*,profiles(display_name)")
        .eq("circle_id", id)
    : { data: [] };
  const { data: sessions } = await client
    .from("sessions")
    .select("*,categories(name),profiles!sessions_host_id_fkey(display_name)")
    .eq("circle_id", id)
    .eq("status", "published")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(6);
  return (
    <div className="page-content">
      <div className="page-head">
        <Link className="text-link" href="/circles">
          ← Study circles
        </Link>
        <h1 style={{ marginTop: 25 }}>{c.title}</h1>
        <p>{c.description}</p>
        <span className="badge">{membership?.status || c.membership_mode}</span>
        {user && !member && (
          <ActionForm
            action="join_circle"
            payload={{ id }}
            label={
              c.membership_mode === "open"
                ? "Join this circle"
                : "Request membership"
            }
          />
        )}
        {!user && (
          <Link className="button" href="/auth/login">
            Sign in to join
          </Link>
        )}
      </div>
      <div className="detail-layout">
        <div>
          <h2 style={{ fontSize: 30 }}>Around the table</h2>
          {member ? (
            <>
              <Realtime table="circle_posts" filter={`circle_id=eq.${id}`} />
              <ActionForm
                action="circle_post"
                payload={{ circle_id: id }}
                label="Share with the circle"
                reset
              >
                <label className="field">
                  A thought, a question, or a resource
                  <textarea name="body" required maxLength={4000} />
                </label>
              </ActionForm>
              {posts?.map((p) => (
                <article className="feed-item" key={p.id}>
                  <header>
                    <Link href={`/people/${p.user_id}`}>
                      {p.profiles?.display_name}
                    </Link>
                    <LocalTime value={p.created_at} />
                  </header>
                  <p>{p.body}</p>
                  {(p.user_id === user?.id || manager) && (
                    <ActionForm
                      action="delete_post"
                      payload={{ id: p.id }}
                      label="Delete post"
                    />
                  )}
                  <Report id={p.id} type="circle_post" />
                </article>
              ))}
            </>
          ) : (
            <div className="notice">
              The discussion is available to approved circle members.
            </div>
          )}
          <section className="detail-section">
            <h2>Coming up together</h2>
            <div className="grid-2">
              {((sessions as unknown as Session[]) || []).map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
            {!sessions?.length && (
              <p className="muted">No upcoming sessions yet.</p>
            )}
            {member && (
              <Link className="text-link" href="/host">
                Host a circle session ↗
              </Link>
            )}
          </section>
        </div>
        <aside className="panel">
          <h3>Our ground rules</h3>
          <p className="detail-copy">{c.rules}</p>
          <h3>Circle members</h3>
          {members?.map((m) => (
            <div className="list-row" key={m.user_id}>
              <Link href={`/people/${m.user_id}`}>
                {m.profiles?.display_name}
              </Link>{" "}
              <span className="badge">{m.status}</span>
              {manager && m.user_id !== c.owner_id && (
                <>
                  {m.status === "pending" && (
                    <ActionForm
                      action="circle_member"
                      payload={{ id, user_id: m.user_id, status: "approved" }}
                      label="Approve"
                    />
                  )}
                  {m.status !== "removed" && (
                    <ActionForm
                      action="circle_member"
                      payload={{ id, user_id: m.user_id, status: "removed" }}
                      label="Remove"
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
