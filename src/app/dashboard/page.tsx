import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SessionCard } from "@/components/sessions/card";
import { type Session } from "@/lib/data";
import { AuthForm } from "@/components/auth-form";
import { LocalTime } from "@/components/local-time";
import { ActionForm } from "@/components/action-form";
import { Realtime } from "@/components/realtime";
export default async function Dashboard() {
  const { user, profile, client } = await requireUser();
  const results = await Promise.all([
    client
      .from("registrations")
      .select("status,sessions(id,title,starts_at,ends_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("sessions")
      .select("*,categories(name),profiles!sessions_host_id_fkey(display_name)")
      .eq("host_id", user.id)
      .order("starts_at", { ascending: false })
      .limit(12),
    client
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    client
      .from("sessions")
      .select("*,categories(name),profiles!sessions_host_id_fkey(display_name)")
      .eq("status", "published")
      .eq("visibility", "public")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(30),
    client
      .from("circle_memberships")
      .select("status,study_circles(id,title)")
      .eq("user_id", user.id),
    client
      .from("saved_sessions")
      .select("sessions(id,title)")
      .eq("user_id", user.id),
    client
      .from("notification_preferences")
      .select("muted")
      .eq("user_id", user.id)
      .maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  const registrations = results[0].data || [];
  const hosted = results[1].data as unknown as Session[];
  const notifications = results[2].data || [];
  const terms = String(profile.interests)
    .toLowerCase()
    .split(/[, ]+/)
    .filter((t) => t.length > 2);
  const recommended = (results[3].data as unknown as Session[])
    .sort((a, b) => {
      const score = (s: Session) =>
        terms.filter((t) =>
          `${s.title} ${s.subject} ${s.tags}`.toLowerCase().includes(t),
        ).length;
      return score(b) - score(a);
    })
    .slice(0, 3);
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">Your learning space</div>
        <h1>
          Keep your curiosity, <em>{profile.display_name.split(" ")[0]}.</em>
        </h1>
        <p>
          A new idea, a familiar face, a little progress. Make room for all
          three.
        </p>
      </div>
      <div className="tabs">
        <Link href="/host">+ Host a session</Link>
        <Link href="/onboarding">Edit profile</Link>
        <Link href="/requests/new">Request a topic</Link>
        <Link href="/doubts/new">Ask for help</Link>
        {results[7].data?.length ? (
          <Link href="/moderation">Moderation</Link>
        ) : null}
      </div>
      <section className="detail-section">
        <h2>My learning</h2>
        {registrations.length ? (
          registrations.map((r) => {
            const s = r.sessions as unknown as {
              id: string;
              title: string;
              starts_at: string;
            };
            return s ? (
              <div className="list-row" key={s.id}>
                <Link href={`/sessions/${s.id}`}>
                  <h3>{s.title}</h3>
                </Link>
                <span className="badge">{r.status}</span>{" "}
                <LocalTime value={s.starts_at} />
              </div>
            ) : null;
          })
        ) : (
          <div className="empty">
            <h3>Your next chapter is waiting.</h3>
            <p>Your registrations and session history will appear here.</p>
            <Link className="text-link" href="/sessions">
              Find a session ↗
            </Link>
          </div>
        )}
      </section>
      <section className="detail-section">
        <h2>A little inspiration</h2>
        <p className="subtle">
          Ordered by your interests, then upcoming time. No AI required.
        </p>
        <div className="grid-3">
          {recommended.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
        {!recommended.length && (
          <p className="muted">
            New sessions will appear as your community publishes them.
          </p>
        )}
      </section>
      <section className="detail-section">
        <h2>Your host desk</h2>
        <div className="grid-3">
          {hosted.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
        {!hosted.length && (
          <Link className="text-link" href="/host">
            Share something you know ↗
          </Link>
        )}
      </section>
      <div className="grid-2">
        <section className="panel">
          <h3>Your circles</h3>
          {results[4].data?.map((m, i) => {
            const c = m.study_circles as unknown as {
              id: string;
              title: string;
            };
            return c ? (
              <p key={i}>
                <Link href={`/circles/${c.id}`}>{c.title} ↗</Link>{" "}
                <span className="badge">{m.status}</span>
              </p>
            ) : null;
          })}
          <Link href="/circles" className="text-link">
            Discover communities ↗
          </Link>
          <h3 style={{ marginTop: 30 }}>Saved for later</h3>
          {results[5].data?.map((r, i) => {
            const s = r.sessions as unknown as { id: string; title: string };
            return s ? (
              <p key={i}>
                <Link href={`/sessions/${s.id}`}>{s.title} ↗</Link>
              </p>
            ) : null;
          })}
        </section>
        <section className="panel" id="notifications">
          <h3>Your notifications</h3>
          <Realtime table="notifications" filter={`user_id=eq.${user.id}`} />
          <ActionForm
            action="read_notifications"
            label="Mark all as read"
            className="inline"
          />
          <ActionForm
            action="mute_notifications"
            payload={{ muted: !results[6].data?.muted }}
            label={
              results[6].data?.muted
                ? "Unmute notifications"
                : "Mute notifications"
            }
            className="inline"
          />
          {notifications.map((n) => (
            <div key={n.id} className="list-row">
              <Link href={n.href}>
                {!n.read_at && "● "}
                {n.message}
              </Link>
              <div className="subtle">
                <LocalTime value={n.created_at} />
              </div>
            </div>
          ))}
          {!notifications.length && <p className="muted">All quiet for now.</p>}
        </section>
      </div>
      <div style={{ marginTop: 30 }}>
        <AuthForm mode="logout" />
      </div>
    </div>
  );
}
