import { randomUUID } from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { firestore } from "./admin";
// Firestore documents have varying shapes. Inputs are validated at command boundaries;
// this internal compatibility type is never accepted from browser payloads as authority.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;
export type Actor = {
  id: string;
  email?: string;
  email_verified: boolean;
} | null;
export class Store {
  private pending = new Map<
    string,
    { table: string; id: string; value: Row | null }
  >();
  private cache = new Map<string, Row | null>();
  constructor(private transaction?: Transaction) {}
  async get(table: string, id: string): Promise<Row | null> {
    if (!id || id.includes("/")) return null;
    const key = `${table}/${id}`;
    if (this.pending.has(key)) return this.pending.get(key)!.value;
    if (this.cache.has(key)) return this.cache.get(key)!;
    const ref = firestore().collection(table).doc(id);
    const snap = this.transaction
      ? await this.transaction.get(ref)
      : await ref.get();
    const row = snap.exists ? { ...snap.data(), id: snap.id } : null;
    this.cache.set(key, row);
    return row;
  }
  async list(table: string, field?: string, value?: unknown): Promise<Row[]> {
    let query: FirebaseFirestore.Query = firestore().collection(table);
    if (field) query = query.where(field, "==", value);
    query = query.limit(1000);
    const snapshot = this.transaction
      ? await this.transaction.get(query)
      : await query.get();
    const rows = new Map(
      snapshot.docs.map((d) => [d.id, { ...d.data(), id: d.id } as Row]),
    );
    for (const p of this.pending.values())
      if (p.table === table) {
        if (!p.value || (field && p.value[field] !== value)) rows.delete(p.id);
        else rows.set(p.id, p.value);
      }
    return [...rows.values()];
  }
  async waitlist(sid: string, count: number): Promise<Row[]> {
    if (count <= 0) return [];
    const query = firestore()
      .collection("registrations")
      .where("session_id", "==", sid)
      .where("status", "==", "waitlisted")
      .orderBy("created_at")
      .limit(count + 1);
    const snapshot = this.transaction
      ? await this.transaction.get(query)
      : await query.get();
    const rows = new Map(
      snapshot.docs.map((d) => [d.id, { ...d.data(), id: d.id } as Row]),
    );
    for (const p of this.pending.values())
      if (
        p.table === "registrations" &&
        rows.has(p.id) &&
        p.value?.status !== "waitlisted"
      )
        rows.delete(p.id);
    return [...rows.values()].slice(0, count);
  }
  set(table: string, id: string, value: Row) {
    if (id.includes("/")) throw new Error("Invalid identifier");
    this.pending.set(`${table}/${id}`, { table, id, value: { ...value, id } });
    if (
      [
        "session_messages",
        "session_questions",
        "question_votes",
        "message_reactions",
      ].includes(table) &&
      value.session_id
    )
      this.signal(`session_${value.session_id}`, {
        session_id: value.session_id,
      });
    if (table === "sessions") this.signal("session_" + id, { session_id: id });
    if (table === "study_circles")
      this.signal("circle_" + id, { circle_id: id });
    if (table === "circle_posts")
      this.signal(`circle_${value.circle_id}`, { circle_id: value.circle_id });
    if (table === "notifications")
      this.signal(`user_${value.user_id}`, { user_id: value.user_id });
    if (table === "instant_doubt_requests") this.signal("doubts", {});
  }
  private signal(id: string, scope: Row) {
    this.pending.set(`changes/${id}`, {
      table: "changes",
      id,
      value: { ...scope, version: randomUUID() },
    });
  }
  async patch(table: string, id: string, value: Row) {
    const old = await this.get(table, id);
    if (!old) throw new Error("Record unavailable");
    this.set(table, id, { ...old, ...value });
  }
  delete(table: string, id: string) {
    this.pending.set(`${table}/${id}`, { table, id, value: null });
  }
  async flush() {
    if (!this.transaction) throw new Error("Writes require a transaction");
    for (const p of this.pending.values()) {
      const ref = firestore().collection(p.table).doc(p.id);
      if (p.value) this.transaction.set(ref, p.value);
      else this.transaction.delete(ref);
    }
  }
}
export const now = () => new Date().toISOString();
export const key = (...parts: string[]) => parts.join("_");
export async function transaction<T>(fn: (s: Store) => Promise<T>) {
  return firestore().runTransaction(async (tx) => {
    const s = new Store(tx);
    const value = await fn(s);
    await s.flush();
    return value;
  });
}
export async function staff(s: Store, actor: Actor, adminOnly = false) {
  if (!actor) return false;
  return Boolean(
    (await s.get("user_roles", key(actor.id, "admin"))) ||
    (!adminOnly && (await s.get("user_roles", key(actor.id, "moderator")))),
  );
}
export async function blocked(s: Store, actor: Actor, other: string) {
  return (
    !!actor &&
    Boolean(
      (await s.get("user_blocks", key(actor.id, other))) ||
      (await s.get("user_blocks", key(other, actor.id))),
    )
  );
}
export async function member(s: Store, actor: Actor, sid: string) {
  if (!actor) return false;
  const session = await s.get("sessions", sid);
  return (
    session?.host_id === actor.id ||
    (await s.get("registrations", key(sid, actor.id)))?.status === "approved"
  );
}
export async function circleMember(
  s: Store,
  actor: Actor,
  cid: string,
  manage = false,
) {
  if (!actor) return false;
  const c = await s.get("study_circles", cid);
  const m = await s.get("circle_memberships", key(cid, actor.id));
  return (
    c?.owner_id === actor.id ||
    (m?.status === "approved" && (!manage || m.role === "moderator"))
  );
}
export async function canRead(
  s: Store,
  actor: Actor,
  table: string,
  row: Row,
): Promise<boolean> {
  switch (table) {
    case "profiles":
    case "tags":
    case "session_requests":
    case "request_interests":
    case "host_proposals":
    case "study_circles":
    case "follows":
    case "doubt_volunteers":
      return true;
    case "categories":
      return row.active || staff(s, actor, true);
    case "profile_academics":
      return row.academic_public || row.user_id === actor?.id;
    case "sessions":
      return (
        row.host_id === actor?.id ||
        (row.status !== "draft" &&
          ["public", "unlisted"].includes(row.visibility)) ||
        (!!actor &&
          ["approved", "pending", "waitlisted"].includes(
            (await s.get("registrations", key(row.id, actor.id)))?.status,
          )) ||
        staff(s, actor)
      );
    case "registrations":
      return (
        row.user_id === actor?.id ||
        (await s.get("sessions", row.session_id))?.host_id === actor?.id
      );
    case "session_messages":
    case "session_questions":
    case "session_resources":
      return (
        (await member(s, actor, row.session_id)) &&
        !(await blocked(s, actor, row.user_id || row.owner_id))
      );
    case "question_votes": {
      const q = await s.get("session_questions", row.question_id);
      return !!q && canRead(s, actor, "session_questions", q);
    }
    case "message_reactions": {
      const m = await s.get("session_messages", row.message_id);
      return !!m && canRead(s, actor, "session_messages", m);
    }
    case "instant_doubt_requests":
      return !(await blocked(s, actor, row.creator_id));
    case "circle_memberships":
      return row.user_id === actor?.id || circleMember(s, actor, row.circle_id);
    case "circle_posts":
      return (
        (await circleMember(s, actor, row.circle_id)) &&
        !(await blocked(s, actor, row.user_id))
      );
    case "host_reviews": {
      const session = await s.get("sessions", row.session_id);
      return !!session && canRead(s, actor, "sessions", session);
    }
    case "notifications":
    case "notification_preferences":
    case "saved_sessions":
    case "topic_follows":
    case "user_blocks":
    case "user_interests":
      return row.user_id === actor?.id;
    case "user_roles":
      return row.user_id === actor?.id || staff(s, actor, true);
    case "reports":
      return row.reporter_id === actor?.id || staff(s, actor);
    case "moderation_actions":
      return staff(s, actor);
    case "audit_logs":
      return staff(s, actor, true);
    default:
      return false;
  }
}
export async function student(s: Store, actor: Actor) {
  if (!actor?.email_verified)
    throw new Error("Sign in with a verified email to continue");
  const profile = await s.get("profiles", actor.id);
  if (!profile?.onboarded || profile.suspended)
    throw new Error(
      "Complete your profile, or contact support if your account is suspended",
    );
  return actor.id;
}
export async function throttle(
  s: Store,
  uid: string,
  action: string,
  limit: number,
) {
  const id = key(uid, action);
  const old = await s.get("rate_limits", id);
  const active = old && Date.now() - old.window < 3600000;
  const count = active ? old.count : 0;
  if (count >= limit)
    throw new Error("Too many requests. Please try again later.");
  s.set("rate_limits", id, {
    user_id: uid,
    action,
    count: count + 1,
    window: active ? old.window : Date.now(),
  });
}
export async function notify(
  s: Store,
  uid: string,
  kind: string,
  message: string,
  href = "/dashboard",
) {
  if ((await s.get("notification_preferences", uid))?.muted) return;
  s.set("notifications", randomUUID(), {
    user_id: uid,
    kind,
    message,
    href,
    read_at: null,
    created_at: now(),
  });
}
