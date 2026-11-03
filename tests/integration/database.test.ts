import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
let pg: PGlite;
const A = "10000000-0000-4000-8000-000000000001",
  B = "10000000-0000-4000-8000-000000000002",
  C = "10000000-0000-4000-8000-000000000003",
  D = "10000000-0000-4000-8000-000000000004";
let category: string;
async function asUser(uid: string | null) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid || "",
  ]);
  await pg.exec(uid ? "set role authenticated" : "set role anon");
}
async function rpc<T = unknown>(
  name: string,
  args: unknown[] = [],
): Promise<T> {
  const result = await pg.query<{ value: T }>(
    `select public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as value`,
    args.map((v) => (typeof v === "object" ? JSON.stringify(v) : v)),
  );
  return result.rows[0]?.value;
}
async function session(overrides: Record<string, unknown> = {}) {
  await asUser(A);
  return rpc<string>("save_session", [
    {
      title: "A hands-on Python workshop",
      description:
        "Learn practical Python by building a small useful project together.",
      subject: "Python",
      category_id: category,
      tags: "python,coding",
      difficulty: "Beginner",
      language: "English",
      starts_at: new Date(Date.now() + 60000).toISOString(),
      ends_at: new Date(Date.now() + 3660000).toISOString(),
      time_zone: "UTC",
      capacity: 1,
      provider: "Google Meet",
      meeting_url: "https://meet.google.com/abc-defg-hij",
      authorized: true,
      objectives: "Build a script",
      prerequisites: "",
      visibility: "public",
      registration_mode: "instant",
      status: "published",
      join_minutes: 15,
      circle_id: "",
      ...overrides,
    },
  ]);
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create publication supabase_realtime;`,
  );
  const dir = resolve("supabase/migrations");
  for (const file of (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    let sql = await readFile(resolve(dir, file), "utf8");
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    try {
      await pg.exec(sql);
    } catch (e) {
      const error = e as Error & { position?: string; internalQuery?: string };
      const pos = Number(error.position);
      throw new Error(
        `${file}: ${error.message} at ${pos}: ${sql.slice(Math.max(0, pos - 140), pos + 140)} ${error.internalQuery || ""}`,
      );
    }
  }
  await pg.exec(await readFile(resolve("supabase/seed.sql"), "utf8"));
  for (const [i, uid] of [A, B, C, D].entries()) {
    await pg.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [uid],
    );
    await asUser(uid);
    await rpc("save_profile", [
      {
        display_name: `Learner ${i}`,
        username: `learner_${i}`,
        bio: "",
        interests: "Python",
        skills: "",
        learn: "",
        teach: "",
        language: "English",
        time_zone: "UTC",
        college: "Private College",
        course: "CS",
        year: "1",
        academic_public: false,
      },
    ]);
    await pg.exec("reset role");
  }
  category = (
    await pg.query<{ id: string }>("select id from categories limit 1")
  ).rows[0].id;
});
afterAll(async () => {
  await pg?.close();
});
describe("PostgreSQL migration, RLS and transactional workflows", () => {
  it("creates an RLS-protected schema and twenty seeded categories", async () => {
    await pg.exec("reset role");
    const r = await pg.query<{ n: number }>(
      "select count(*)::int n from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
    );
    expect(r.rows[0].n).toBe(0);
    expect((await pg.query("select * from categories")).rows).toHaveLength(20);
  });
  it("registers once and enforces capacity inside the database", async () => {
    const sid = await session();
    await asUser(B);
    expect(await rpc("register_session", [sid])).toBe("approved");
    expect(await rpc("register_session", [sid])).toBe("approved");
    await asUser(C);
    expect(await rpc("register_session", [sid])).toBe("waitlisted");
    await asUser(A);
    const r = await pg.query(
      "select * from registrations where session_id=$1",
      [sid],
    );
    expect(r.rows).toHaveLength(2);
  });
  it("promotes the waitlist when an approved student cancels", async () => {
    const sid = await session();
    await asUser(B);
    await rpc("register_session", [sid]);
    await asUser(C);
    await rpc("register_session", [sid]);
    await asUser(B);
    await rpc("change_registration", [sid, B, "cancelled"]);
    await asUser(C);
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from registrations where session_id=$1",
          [sid],
        )
      ).rows[0].status,
    ).toBe("approved");
  });
  it("requires host approval and prevents over-approval", async () => {
    const sid = await session({ registration_mode: "approval" });
    await asUser(B);
    expect(await rpc("register_session", [sid])).toBe("pending");
    await asUser(C);
    await rpc("register_session", [sid]);
    await asUser(A);
    await rpc("change_registration", [sid, B, "approved"]);
    await expect(
      rpc("change_registration", [sid, C, "approved"]),
    ).rejects.toThrow("full");
  });
  it("denies anonymous and non-registrant access to meeting URLs", async () => {
    const sid = await session();
    await asUser(null);
    await expect(rpc("join_details", [sid])).rejects.toThrow();
    await expect(pg.query("select * from session_links")).rejects.toThrow();
    await asUser(C);
    await expect(rpc("join_details", [sid])).rejects.toThrow("Joining details");
    expect(
      (await pg.query("select * from sessions where id=$1", [sid])).rows[0],
    ).not.toHaveProperty("meeting_url");
  });
  it("reveals meeting URL only in the join window and respects revocation", async () => {
    const sid = await session();
    await asUser(B);
    await rpc("register_session", [sid]);
    expect(await rpc("join_details", [sid])).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
    await asUser(A);
    await rpc("session_control", [sid, "revoke"]);
    await asUser(B);
    await expect(rpc("join_details", [sid])).rejects.toThrow("Joining details");
    const later = await session({
      starts_at: new Date(Date.now() + 86400000).toISOString(),
      ends_at: new Date(Date.now() + 90000000).toISOString(),
    });
    await asUser(B);
    await rpc("register_session", [later]);
    await expect(rpc("join_details", [later])).rejects.toThrow(
      "Joining details",
    );
  });
  it("protects private and draft session metadata", async () => {
    const draft = await session({ status: "draft" });
    const privateId = await session({ visibility: "private" });
    await asUser(B);
    expect(
      (
        await pg.query("select * from sessions where id in ($1,$2)", [
          draft,
          privateId,
        ])
      ).rows,
    ).toHaveLength(0);
    await expect(rpc("register_session", [privateId])).rejects.toThrow();
  });
  it("rejects invalid domains even when bypassing the web API", async () => {
    await expect(
      session({
        meeting_url: "https://meet.google.com.evil.example/abc-defg-hij",
      }),
    ).rejects.toThrow("approved HTTPS");
    await expect(
      session({
        meeting_url: "https://zoom.us/j/123?%72edirect=https://evil.example",
        provider: "Zoom",
      }),
    ).rejects.toThrow("approved HTTPS");
    await expect(session({ provider: "Zoom" })).rejects.toThrow("provider");
  });
  it("prevents non-host cancellation and registration manipulation", async () => {
    const sid = await session();
    await asUser(B);
    await rpc("register_session", [sid]);
    await asUser(C);
    await expect(rpc("session_control", [sid, "cancel"])).rejects.toThrow(
      "Host access",
    );
    await expect(
      rpc("change_registration", [sid, B, "cancelled"]),
    ).rejects.toThrow("Not authorized");
    await expect(
      pg.query("update sessions set title='Hijacked title' where id=$1", [sid]),
    ).rejects.toThrow();
  });
  it("cancels sessions and denies joining after cancellation", async () => {
    const sid = await session();
    await asUser(B);
    await rpc("register_session", [sid]);
    await asUser(A);
    await rpc("session_control", [sid, "cancel"]);
    await asUser(B);
    await expect(rpc("join_details", [sid])).rejects.toThrow();
    expect(
      (
        await pg.query(
          "select * from notifications where kind='session_cancelled'",
        )
      ).rows.length,
    ).toBeGreaterThan(0);
  });
  it("restricts discussions to members and validates reply session", async () => {
    const sid = await session();
    const other = await session();
    await asUser(B);
    await expect(
      rpc("community_action", ["message", { session_id: sid, body: "Hello" }]),
    ).rejects.toThrow("registration");
    await rpc("register_session", [sid]);
    const message = await rpc<string>("community_action", [
      "message",
      { session_id: sid, body: "Hello everyone" },
    ]);
    await asUser(A);
    expect(
      (await pg.query("select * from session_messages where id=$1", [message]))
        .rows,
    ).toHaveLength(1);
    await expect(
      rpc("community_action", [
        "message",
        { session_id: other, parent_id: message, body: "Cross-session reply" },
      ]),
    ).rejects.toThrow("belong");
    await asUser(C);
    expect(
      (await pg.query("select * from session_messages where id=$1", [message]))
        .rows,
    ).toHaveLength(0);
  });
  it("toggles a unique question vote and notifies on host answer", async () => {
    const sid = await session();
    await asUser(B);
    await rpc("register_session", [sid]);
    const q = await rpc<string>("community_action", [
      "question",
      { session_id: sid, body: "How does a list work?" },
    ]);
    await rpc("community_action", ["vote", { id: q }]);
    expect(
      (await pg.query("select * from question_votes where question_id=$1", [q]))
        .rows,
    ).toHaveLength(1);
    await rpc("community_action", ["vote", { id: q }]);
    expect(
      (await pg.query("select * from question_votes where question_id=$1", [q]))
        .rows,
    ).toHaveLength(0);
    await asUser(A);
    await rpc("community_action", [
      "answer",
      { id: q, body: "A list is an ordered collection." },
    ]);
    await asUser(B);
    expect(
      (
        await pg.query(
          "select * from notifications where kind='question_answered'",
        )
      ).rows.length,
    ).toBeGreaterThan(0);
  });
  it("keeps academic details private and prevents role escalation", async () => {
    await asUser(B);
    expect(
      (await pg.query("select * from profile_academics where user_id=$1", [A]))
        .rows,
    ).toHaveLength(0);
    await expect(
      pg.query("insert into user_roles values($1,'admin')", [B]),
    ).rejects.toThrow();
    await expect(
      pg.query("update profiles set suspended=false where id=$1", [B]),
    ).rejects.toThrow();
    expect(await rpc("is_staff")).toBe(false);
  });
  it("supports request interest, accepted proposal, and a published session", async () => {
    await asUser(C);
    const req = await rpc<string>("community_action", [
      "request",
      {
        topic: "Binary search trees workshop",
        description: "Please explain insertion and deletion with examples.",
        category_id: category,
        difficulty: "Beginner",
        preferred_schedule: "Weekend",
        language: "English",
        tags: "trees",
      },
    ]);
    await asUser(B);
    await rpc("community_action", ["interest", { id: req }]);
    await asUser(A);
    const proposal = await rpc<string>("community_action", [
      "propose",
      { id: req, body: "I can explain trees using Python." },
    ]);
    await asUser(C);
    await rpc("community_action", ["accept_proposal", { id: proposal }]);
    await expect(
      rpc("community_action", ["accept_proposal", { id: proposal }]),
    ).rejects.toThrow("already selected");
    const sid = await session();
    await rpc("community_action", [
      "link_request",
      { id: req, session_id: sid },
    ]);
    await asUser(B);
    expect(
      (
        await pg.query(
          "select * from notifications where kind='request_scheduled'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("selects only one doubt helper and protects the shared link", async () => {
    await asUser(C);
    const did = await rpc<string>("community_action", [
      "doubt",
      {
        topic: "Help with tree deletion",
        subject: "DSA",
        description: "I cannot understand deleting the root node.",
        urgency: "Now",
        expected_minutes: 20,
        language: "English",
        difficulty: "Beginner",
      },
    ]);
    await asUser(A);
    await rpc("community_action", ["volunteer", { id: did }]);
    await asUser(B);
    await rpc("community_action", ["volunteer", { id: did }]);
    await asUser(C);
    await rpc("community_action", ["accept_helper", { id: did, user_id: A }]);
    await expect(
      rpc("community_action", ["accept_helper", { id: did, user_id: B }]),
    ).rejects.toThrow();
    await rpc("community_action", [
      "doubt_link",
      {
        id: did,
        meeting_url: "https://meet.google.com/abc-defg-hij",
        authorized: true,
      },
    ]);
    await asUser(B);
    await expect(rpc("doubt_join_details", [did])).rejects.toThrow();
    await asUser(A);
    expect(await rpc("doubt_join_details", [did])).toContain("meet.google.com");
  });
  it("enforces circle membership approval and moderator removal", async () => {
    await asUser(A);
    const cid = await rpc<string>("community_action", [
      "circle",
      {
        title: "Python Beginners",
        description: "Learn Python together every week.",
        category_id: category,
        rules: "Be kind and curious.",
        membership_mode: "approval",
      },
    ]);
    await asUser(B);
    await rpc("community_action", ["join_circle", { id: cid }]);
    await expect(
      rpc("community_action", [
        "circle_post",
        { circle_id: cid, body: "Hello" },
      ]),
    ).rejects.toThrow("membership");
    await asUser(A);
    await rpc("community_action", [
      "circle_member",
      { id: cid, user_id: B, status: "approved" },
    ]);
    await asUser(B);
    await rpc("community_action", [
      "circle_post",
      { circle_id: cid, body: "Hello circle!" },
    ]);
    await asUser(A);
    await rpc("community_action", [
      "circle_member",
      { id: cid, user_id: B, status: "removed" },
    ]);
    await asUser(B);
    expect(
      (await pg.query("select * from circle_posts where circle_id=$1", [cid]))
        .rows,
    ).toHaveLength(0);
    await expect(
      rpc("community_action", ["join_circle", { id: cid }]),
    ).rejects.toThrow("removed");
  });
  it("allows one review only after completion and rejects self-review", async () => {
    const sid = await session();
    await asUser(B);
    await rpc("register_session", [sid]);
    const p = {
      id: sid,
      rating: 5,
      body: "Helpful session.",
      relevance: 5,
      clarity: 4,
      helpfulness: 5,
    };
    await expect(rpc("community_action", ["review", p])).rejects.toThrow(
      "completed",
    );
    await pg.exec("reset role");
    await pg.query(
      "update sessions set starts_at=now()-interval '2 hours', ends_at=now()-interval '1 hour' where id=$1",
      [sid],
    );
    await asUser(B);
    await rpc("community_action", ["review", p]);
    await expect(rpc("community_action", ["review", p])).rejects.toThrow(
      "unique",
    );
    await asUser(A);
    await expect(rpc("community_action", ["review", p])).rejects.toThrow();
  });
  it("allows reports but protects moderation and audit", async () => {
    const sid = await session();
    await asUser(B);
    const rid = await rpc<string>("community_action", [
      "report",
      {
        id: sid,
        target_type: "session",
        body: "Misleading description needs review",
      },
    ]);
    await expect(
      rpc("moderate", [rid, "dismiss", "Reviewed carefully"]),
    ).rejects.toThrow("Moderator");
    await pg.exec("reset role");
    await pg.query("insert into user_roles values($1,'moderator')", [D]);
    await asUser(D);
    await rpc("moderate", [rid, "dismiss", "Reviewed carefully; no violation"]);
    expect(
      (
        await pg.query("select * from moderation_actions where report_id=$1", [
          rid,
        ])
      ).rows,
    ).toHaveLength(1);
    await asUser(B);
    expect(
      (await pg.query("select * from moderation_actions")).rows,
    ).toHaveLength(0);
  });
  it("blocks student calls to internal privileged helpers", async () => {
    await asUser(B);
    for (const sql of [
      "select notify($1,'fake','fake','/')",
      "select promote_waitlist($1)",
      "select throttle('hosting',100000)",
    ]) {
      await expect(
        pg.query(sql, sql.includes("$1") ? [B] : []),
      ).rejects.toThrow("permission denied");
    }
    await expect(rpc("deliver_reminders")).rejects.toThrow("permission denied");
  });
});
