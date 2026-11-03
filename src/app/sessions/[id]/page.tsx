import Link from "next/link";
import { notFound } from "next/navigation";
import { db, currentUser } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { lifecycle, type Session } from "@/lib/data";
import { ActionForm } from "@/components/action-form";
import { LocalTime } from "@/components/local-time";
import { Realtime } from "@/components/realtime";
import { Report } from "@/components/report";
export default async function SessionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!configured()) notFound();
  const client = await db();
  const user = await currentUser();
  const { data: raw, error } = await client
    .from("sessions")
    .select("*,categories(name),profiles!sessions_host_id_fkey(display_name)")
    .eq("id", id)
    .maybeSingle();
  if (error || !raw) notFound();
  const s = raw as unknown as Session;
  const host = user?.id === s.host_id;
  const { data: reg } = user
    ? await client
        .from("registrations")
        .select("*")
        .eq("session_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const member = host || reg?.status === "approved";
  const { data: seats } = await client.rpc("session_capacity", { sid: id });
  const [messages, questions, registrants, reviews] = await Promise.all([
    member
      ? client
          .from("session_messages")
          .select("*,profiles(display_name),message_reactions(user_id)")
          .eq("session_id", id)
          .order("created_at")
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    member
      ? client
          .from("session_questions")
          .select("*,profiles(display_name),question_votes(user_id)")
          .eq("session_id", id)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    host
      ? client
          .from("registrations")
          .select("*,profiles(display_name)")
          .eq("session_id", id)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    client
      .from("host_reviews")
      .select("*,profiles(display_name)")
      .eq("session_id", id)
      .limit(50),
  ]);
  for (const r of [messages, questions, registrants, reviews])
    if (r.error) throw new Error(r.error.message);
  return (
    <div className="page-content">
      <div className="page-head">
        <Link className="text-link" href="/sessions">
          ← All sessions
        </Link>
        <div className="eyebrow" style={{ marginTop: 25 }}>
          {s.categories?.name} · {lifecycle(s)}
        </div>
        <h1>{s.title}</h1>
        <p>
          Hosted by{" "}
          <Link className="text-link" href={`/people/${s.host_id}`}>
            {s.profiles?.display_name}
          </Link>{" "}
          · {s.difficulty} · {s.language}
        </p>
      </div>
      <div className="detail-layout">
        <div>
          <section className="panel">
            <h2 style={{ fontSize: 30 }}>A little about this session</h2>
            <p className="detail-copy">{s.description}</p>
            {s.objectives && (
              <>
                <h3>What you’ll take away</h3>
                <p className="detail-copy">{s.objectives}</p>
              </>
            )}
            {s.prerequisites && (
              <>
                <h3>Before you join</h3>
                <p className="detail-copy">{s.prerequisites}</p>
              </>
            )}
            <div className="chips">
              {s.tags
                .split(",")
                .filter(Boolean)
                .map((t) => (
                  <span className="badge" key={t}>
                    {t.trim()}
                  </span>
                ))}
            </div>
            {s.circle_id && (
              <Link href={`/circles/${s.circle_id}`} className="text-link">
                Part of a study circle ↗
              </Link>
            )}
          </section>
          {host && (
            <section className="detail-section panel">
              <h2>Your host desk</h2>
              <Link
                className="button button-outline"
                href={`/sessions/${id}/edit`}
              >
                Edit session
              </Link>
              <ActionForm
                className="inline"
                action="session_control"
                payload={{
                  id,
                  control: s.registration_closed ? "reopen" : "close",
                }}
                label={
                  s.registration_closed
                    ? "Open registration"
                    : "Close registration"
                }
              />
              <ActionForm
                className="inline"
                action="session_control"
                payload={{ id, control: "revoke" }}
                label="Revoke joining access"
                confirm="Revoke participant access to the link inside PeerWave? This does not remove anyone from an external meeting."
              />
              <ActionForm
                className="inline"
                action="session_control"
                payload={{ id, control: "cancel" }}
                label="Cancel session"
                confirm="Cancel this session and notify registrants?"
              />
              <h3 style={{ marginTop: 25 }}>Registrants</h3>
              {registrants.data?.map((r) => (
                <div className="list-row" key={r.id}>
                  <Link href={`/people/${r.user_id}`}>
                    {r.profiles?.display_name}
                  </Link>{" "}
                  <span className="badge">{r.status}</span>
                  {["pending", "waitlisted"].includes(r.status) && (
                    <>
                      <ActionForm
                        className="inline"
                        action="registration"
                        payload={{ id, user_id: r.user_id, status: "approved" }}
                        label="Approve"
                      />
                      <ActionForm
                        className="inline"
                        action="registration"
                        payload={{ id, user_id: r.user_id, status: "rejected" }}
                        label="Decline"
                      />
                    </>
                  )}
                  {r.status === "approved" && (
                    <ActionForm
                      className="inline"
                      action="registration"
                      payload={{ id, user_id: r.user_id, status: "removed" }}
                      label="Remove"
                    />
                  )}
                </div>
              ))}
              {!registrants.data?.length && (
                <p className="muted">No registrations yet.</p>
              )}
            </section>
          )}
          <section className="detail-section" id="discussion">
            <h2>Keep the conversation going.</h2>
            {member ? (
              <>
                <Realtime
                  table="session_messages"
                  filter={`session_id=eq.${id}`}
                />
                <ActionForm
                  action="message"
                  payload={{ session_id: id }}
                  label="Post message"
                  reset
                >
                  <label className="field">
                    Share a thought or a useful resource
                    <textarea name="body" maxLength={4000} required />
                  </label>
                  {host && (
                    <label className="check">
                      <input name="announcement" type="checkbox" />
                      Post as an announcement
                    </label>
                  )}
                </ActionForm>
                <p className="subtle">
                  Showing up to 100 messages, oldest first.
                </p>
                {messages.data?.map((m) => (
                  <article
                    className={`feed-item ${m.parent_id ? "reply" : ""}`}
                    key={m.id}
                  >
                    <header>
                      <Link href={`/people/${m.user_id}`}>
                        {m.profiles?.display_name}
                      </Link>
                      <span className="subtle">
                        <LocalTime value={m.created_at} />
                        {m.edited_at && " · edited"}
                      </span>
                    </header>
                    {m.announcement && (
                      <span className="badge">Host announcement</span>
                    )}
                    {m.parent_id && (
                      <small className="muted">
                        Reply to an earlier message
                      </small>
                    )}
                    <p>{m.body}</p>
                    <ActionForm
                      className="inline"
                      action="react"
                      payload={{ id: m.id }}
                      label={`Helpful · ${m.message_reactions?.length || 0}`}
                    />
                    <details>
                      <summary>Reply</summary>
                      <ActionForm
                        action="message"
                        payload={{ session_id: id, parent_id: m.id }}
                        label="Reply"
                        reset
                      >
                        <label className="field">
                          Your reply
                          <textarea name="body" required maxLength={4000} />
                        </label>
                      </ActionForm>
                    </details>
                    {m.user_id === user?.id && (
                      <details>
                        <summary>Edit message</summary>
                        <ActionForm
                          action="edit_message"
                          payload={{ id: m.id }}
                          label="Save edit"
                        >
                          <label className="field">
                            Message
                            <textarea
                              name="body"
                              defaultValue={m.body}
                              required
                              maxLength={4000}
                            />
                          </label>
                        </ActionForm>
                      </details>
                    )}
                    {(host || m.user_id === user?.id) && (
                      <ActionForm
                        className="inline"
                        action="delete_message"
                        payload={{ id: m.id }}
                        label="Delete"
                        confirm="Delete this message and its replies?"
                      />
                    )}
                    <Report id={m.id} type="message" />
                  </article>
                ))}
                {!messages.data?.length && (
                  <p className="muted">
                    Break the ice. Say hello to your fellow learners.
                  </p>
                )}
              </>
            ) : (
              <div className="notice">
                Discussion opens for approved participants. Register to join the
                conversation.
              </div>
            )}
          </section>
          <section className="detail-section">
            <h2>No question too small.</h2>
            {member ? (
              <>
                <Realtime
                  table="session_questions"
                  filter={`session_id=eq.${id}`}
                />
                <ActionForm
                  action="question"
                  payload={{ session_id: id }}
                  label="Ask a question"
                  reset
                >
                  <label className="field">
                    What would you like to understand?
                    <textarea name="body" maxLength={4000} required />
                  </label>
                </ActionForm>
                {questions.data?.map((q) => (
                  <article className="feed-item" key={q.id}>
                    <span className="badge">
                      {q.pinned ? "Pinned · " : ""}
                      {q.resolved ? "Resolved" : "Open question"}
                    </span>
                    <p>{q.body}</p>
                    <small className="muted">
                      Asked by {q.profiles?.display_name}
                    </small>
                    {q.answer && (
                      <div className="notice">
                        <strong>Host’s answer</strong>
                        <p>{q.answer}</p>
                      </div>
                    )}
                    <ActionForm
                      className="inline"
                      action="vote"
                      payload={{ id: q.id }}
                      label={`I’m curious too · ${q.question_votes?.length || 0}`}
                    />
                    {(host || q.user_id === user?.id) && (
                      <ActionForm
                        className="inline"
                        action="resolve"
                        payload={{ id: q.id }}
                        label={q.resolved ? "Reopen" : "Mark resolved"}
                      />
                    )}
                    {host && (
                      <>
                        <ActionForm
                          className="inline"
                          action="pin"
                          payload={{ id: q.id }}
                          label={q.pinned ? "Unpin" : "Pin"}
                        />
                        <details>
                          <summary>Answer this question</summary>
                          <ActionForm
                            action="answer"
                            payload={{ id: q.id }}
                            label="Post answer"
                          >
                            <label className="field">
                              Your answer
                              <textarea name="body" required maxLength={4000} />
                            </label>
                          </ActionForm>
                        </details>
                      </>
                    )}
                  </article>
                ))}
              </>
            ) : (
              <p className="muted">
                Approved participants can ask questions and vote on what they
                want to learn.
              </p>
            )}
          </section>
          <section className="detail-section">
            <h2>Reflections from learners</h2>
            <p className="subtle">
              Reviews come from approved registrants. External attendance is not
              verified.
            </p>
            {reviews.data?.map((r) => (
              <div className="list-row" key={r.id}>
                <strong>
                  {r.rating}/5 · {r.profiles?.display_name}
                </strong>
                <p>{r.feedback}</p>
              </div>
            ))}
            {reg?.status === "approved" &&
              lifecycle(s) === "Completed" &&
              !host && (
                <ActionForm
                  action="review"
                  payload={{ id }}
                  label="Share feedback"
                >
                  <div className="form-grid">
                    {["rating", "relevance", "clarity", "helpfulness"].map(
                      (k) => (
                        <label className="field" key={k}>
                          {k}
                          <select name={k}>
                            {[5, 4, 3, 2, 1].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </label>
                      ),
                    )}
                  </div>
                  <label className="field">
                    Your reflection · optional
                    <textarea name="body" maxLength={2000} />
                  </label>
                </ActionForm>
              )}
          </section>
        </div>
        <aside className="panel">
          <span className="badge">Free, always.</span>
          <h3 style={{ marginTop: 20 }}>Make space to learn.</h3>
          <p>
            <LocalTime value={s.starts_at} />
          </p>
          <p className="subtle">
            {Math.round(
              (+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000,
            )}{" "}
            minutes · {s.provider}
            <br />
            Host time zone: {s.time_zone}
          </p>
          <hr className="divider" />
          <p>
            {seats ?? 0} of {s.capacity} places remaining
          </p>
          <p className="subtle">
            {s.registration_mode === "approval"
              ? "The host reviews registration requests."
              : "Full sessions use a first-come waitlist."}
          </p>
          {!user ? (
            <Link className="button" href="/auth/login">
              Sign in to register ↗
            </Link>
          ) : !host ? (
            <>
              {reg && <p className="badge">Your registration: {reg.status}</p>}
              {(!reg || reg.status === "cancelled") &&
                s.status === "published" &&
                lifecycle(s) !== "Completed" && (
                  <ActionForm
                    action="register"
                    payload={{ id }}
                    label={seats === 0 ? "Join waitlist" : "Register for free"}
                  />
                )}
              {reg &&
                ["approved", "waitlisted", "pending"].includes(reg.status) && (
                  <ActionForm
                    action="registration"
                    payload={{ id, user_id: user.id, status: "cancelled" }}
                    label="Cancel registration"
                  />
                )}
            </>
          ) : null}
          {member && (
            <ActionForm
              action="join"
              payload={{ id }}
              label="Get joining details"
            />
          )}
          <p className="subtle">
            Joining opens {s.join_minutes} minutes before the scheduled start,
            for approved participants. The schedule does not confirm the
            external meeting is live.
          </p>
          {user && (
            <>
              <ActionForm
                action="save"
                payload={{ id }}
                label="Toggle saved session"
              />
              <Report id={id} type="session" />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
