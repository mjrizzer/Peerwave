import { notFound } from "next/navigation";
import { db, currentUser } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { type Session, lifecycle } from "@/lib/data";
import { ActionForm } from "@/components/action-form";
import { Report } from "@/components/report";
import { SessionCard } from "@/components/sessions/card";
export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!configured()) notFound();
  const { id } = await params;
  const client = await db();
  const user = await currentUser();
  const { data: p } = await client
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("onboarded", true)
    .maybeSingle();
  if (!p) notFound();
  const [sessions, followers, reviews, academic, following, blocked] =
    await Promise.all([
      client
        .from("sessions")
        .select(
          "*,categories(name),profiles!sessions_host_id_fkey(display_name)",
        )
        .eq("host_id", id)
        .eq("visibility", "public")
        .neq("status", "draft")
        .order("starts_at", { ascending: false })
        .limit(60),
      client
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("followed_id", id),
      client
        .from("host_reviews")
        .select("rating,sessions!inner(host_id)")
        .eq("sessions.host_id", id),
      client
        .from("profile_academics")
        .select("*")
        .eq("user_id", id)
        .maybeSingle(),
      user
        ? client
            .from("follows")
            .select("followed_id")
            .eq("follower_id", user.id)
            .eq("followed_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? client
            .from("user_blocks")
            .select("blocked_id")
            .eq("user_id", user.id)
            .eq("blocked_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  const rows = (sessions.data as unknown as Session[]) || [];
  const ratings = reviews.data || [];
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">A learner. A teacher. A peer.</div>
        <h1>{p.display_name}</h1>
        <p>
          @{p.username} · {p.language}
        </p>
        {user && user.id !== id && (
          <>
            <ActionForm
              action="follow"
              payload={{ id }}
              label={following.data ? "Unfollow" : "Follow this learner"}
              className="inline"
            />
            <ActionForm
              action="block"
              payload={{ id }}
              label={blocked.data ? "Unblock user" : "Block user"}
              className="inline"
            />
          </>
        )}
      </div>
      <div className="grid-2">
        <section className="panel">
          <h3>A little about me</h3>
          <p className="detail-copy">{p.bio || "Still writing my story."}</p>
          <p>
            <strong>Curious about:</strong>{" "}
            {p.interests || "A little of everything"}
          </p>
          <p>
            <strong>Learning:</strong> {p.learn || "Something new"}
          </p>
          <p>
            <strong>Happy to teach:</strong> {p.teach || "Finding my thing"}
          </p>
          <p>
            <strong>Skills:</strong> {p.skills || "Growing every day"}
          </p>
          {academic.data && (
            <p className="muted">
              {[academic.data.college, academic.data.course, academic.data.year]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </section>
        <section className="panel">
          <h3>Growing, together.</h3>
          <p>{followers.count || 0} followers</p>
          <p>
            {rows.length} public hosted sessions ·{" "}
            {rows.filter((s) => lifecycle(s) === "Completed").length} completed
          </p>
          <p>
            {ratings.length
              ? (
                  ratings.reduce((n, r) => n + r.rating, 0) / ratings.length
                ).toFixed(1) +
                " / 5 from " +
                ratings.length +
                " registrant reviews"
              : "No reviews yet"}
          </p>
          <p className="subtle">
            Registration and reviews do not verify attendance at external
            meetings. Session totals show up to 60 recent public sessions.
          </p>
          {user && user.id !== id && <Report id={id} type="profile" />}
        </section>
      </div>
      <section className="detail-section">
        <h2>Learning moments I’ve hosted</h2>
        <div className="grid-3">
          {rows.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
