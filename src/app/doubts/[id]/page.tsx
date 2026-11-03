import Link from "next/link";
import { notFound } from "next/navigation";
import { db, currentUser } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { ActionForm } from "@/components/action-form";
import { Realtime } from "@/components/realtime";
export default async function Doubt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!configured()) notFound();
  const { id } = await params;
  const client = await db();
  const user = await currentUser();
  const { data: d } = await client
    .from("instant_doubt_requests")
    .select("*,profiles!instant_doubt_requests_creator_id_fkey(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();
  const { data: volunteers } = await client
    .from("doubt_volunteers")
    .select("*,profiles(display_name)")
    .eq("doubt_id", id);
  const owner = user?.id === d.creator_id;
  const participant = owner || user?.id === d.helper_id;
  const pending = d.status === "pending" && new Date(d.expires_at) > new Date();
  return (
    <div className="page-content">
      <div className="page-head">
        <Link className="text-link" href="/doubts">
          ← Doubt rooms
        </Link>
        <h1 style={{ marginTop: 25 }}>{d.topic}</h1>
        <p>
          {d.profiles?.display_name} · {d.subject} · {d.language} ·{" "}
          {d.expected_minutes} minutes
        </p>
        <span className="badge">
          {d.status === "pending" && !pending ? "expired" : d.status}
        </span>
      </div>
      <Realtime table="instant_doubt_requests" filter={`id=eq.${id}`} />
      <div className="grid-2" style={{ marginTop: 25 }}>
        <section className="panel">
          <h3>Where I’m stuck</h3>
          <p className="detail-copy">{d.description}</p>
          {user && !owner && pending && (
            <ActionForm
              action="volunteer"
              payload={{ id }}
              label="I can help"
            />
          )}
          {!user && (
            <Link className="button" href="/auth/login">
              Sign in to help
            </Link>
          )}
          <h3 style={{ marginTop: 30 }}>Helping hands</h3>
          {volunteers?.map((v) => (
            <div key={v.user_id} className="list-row">
              <Link href={`/people/${v.user_id}`}>
                {v.profiles?.display_name}
              </Link>
              {owner && pending && (
                <ActionForm
                  action="accept_helper"
                  payload={{ id, user_id: v.user_id }}
                  label="Choose this helper"
                />
              )}
              {d.helper_id === v.user_id && (
                <span className="badge">Selected helper</span>
              )}
            </div>
          ))}
        </section>
        <section className="panel">
          <h3>Your shared space</h3>
          {participant && d.status === "accepted" ? (
            <>
              <ActionForm
                action="doubt_link"
                payload={{ id }}
                label="Share meeting link"
              >
                <label className="field">
                  Approved Meet, Zoom, or Teams URL
                  <input name="meeting_url" type="url" required />
                </label>
                <label className="check">
                  <input name="authorized" type="checkbox" required />I am
                  permitted to share this link.
                </label>
              </ActionForm>
              <ActionForm
                action="doubt_join"
                payload={{ id }}
                label="Get joining details"
              />
              {owner && (
                <ActionForm
                  action="resolve_doubt"
                  payload={{ id }}
                  label="My doubt is resolved"
                />
              )}
            </>
          ) : (
            <p className="muted">
              After a helper is selected, the two participants can share an
              authorized external meeting link here.
            </p>
          )}
          {owner && ["pending", "accepted"].includes(d.status) && (
            <ActionForm
              action="cancel_doubt"
              payload={{ id }}
              label="Cancel request"
            />
          )}
        </section>
      </div>
    </div>
  );
}
