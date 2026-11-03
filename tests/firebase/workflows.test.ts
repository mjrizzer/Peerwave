import { beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { executeRpc } from "@/lib/firebase/commands";
import { firestore, adminAuth } from "@/lib/firebase/admin";
import { Query } from "@/lib/firebase/query";
import { type Actor } from "@/lib/firebase/store";
const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const enabled =
  process.env.FIRESTORE_EMULATOR_HOST && project === "demo-peerwave";
const A = { id: randomUUID(), email_verified: true },
  B = { id: randomUUID(), email_verified: true },
  C = { id: randomUUID(), email_verified: true };
const category = "category-test-" + randomUUID();
async function call(
  actor: Actor,
  name: string,
  args: Record<string, unknown> = {},
) {
  return executeRpc(actor, name, args);
}
async function session(overrides: Record<string, unknown> = {}) {
  return call(A, "save_session", {
    p: {
      title: "Learn Python together",
      description:
        "Build a useful Python project and discuss how it works together.",
      category_id: category,
      subject: "Python",
      tags: "python",
      difficulty: "Beginner",
      language: "English",
      starts_at: new Date(Date.now() + 60000).toISOString(),
      ends_at: new Date(Date.now() + 3660000).toISOString(),
      time_zone: "UTC",
      capacity: 1,
      provider: "Google Meet",
      meeting_url: "https://meet.google.com/abc-defg-hij",
      authorized: true,
      objectives: "Learn together",
      prerequisites: "",
      visibility: "public",
      registration_mode: "instant",
      status: "published",
      join_minutes: 15,
      circle_id: "",
      ...overrides,
    },
  }) as Promise<string>;
}
describe.skipIf(!enabled)(
  "Firebase emulator authorization and transactions",
  () => {
    beforeAll(async () => {
      for (const actor of [A, B, C]) {
        await adminAuth().createUser({
          uid: actor.id,
          email: `${actor.id}@peerwave.test`,
          password: "PeerWave-Test-Only-2030!",
          emailVerified: true,
        });
        await firestore()
          .collection("profiles")
          .doc(actor.id)
          .set({
            id: actor.id,
            display_name: "Test learner",
            username: actor.id,
            onboarded: true,
            suspended: false,
            created_at: new Date().toISOString(),
          });
      }
      await firestore()
        .collection("categories")
        .doc(category)
        .set({
          id: category,
          name: "Test coding",
          slug: category,
          active: true,
        });
    });
    it("stores profiles without accepting self-assigned roles", async () => {
      await call(B, "save_profile", {
        p: {
          display_name: "Learner B",
          username: "learner_" + B.id.slice(0, 8),
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
          role: "admin",
        },
      });
      expect(await call(B, "is_admin")).toBe(false);
      expect(
        (await new Query("profile_academics", C).eq("user_id", B.id)).data,
      ).toHaveLength(0);
    });
    it("enforces capacity for genuinely simultaneous requests", async () => {
      const sid = await session();
      const results = await Promise.all([
        call(B, "register_session", { sid }),
        call(C, "register_session", { sid }),
      ]);
      expect([...results].sort()).toEqual(["approved", "waitlisted"]);
      expect(await call(null, "session_capacity", { sid })).toBe(0);
      const winner = results[0] === "approved" ? B : C;
      expect(await call(winner, "register_session", { sid })).toBe("approved");
      const regs = await firestore()
        .collection("registrations")
        .where("session_id", "==", sid)
        .get();
      expect(regs.size).toBe(2);
    });
    it("promotes the waitlist transactionally", async () => {
      const sid = await session();
      await call(B, "register_session", { sid });
      await call(C, "register_session", { sid });
      await call(B, "change_registration", {
        sid,
        target: B.id,
        decision: "cancelled",
      });
      expect(
        (
          await firestore()
            .collection("registrations")
            .doc(`${sid}_${C.id}`)
            .get()
        ).data()?.status,
      ).toBe("approved");
    });
    it("protects meeting URLs, join windows and revocation", async () => {
      const sid = await session();
      await expect(call(null, "join_details", { sid })).rejects.toThrow();
      await expect(call(C, "join_details", { sid })).rejects.toThrow();
      expect((await new Query("session_links", B)).data).toHaveLength(0);
      const publicRow = (
        await new Query("sessions", null).eq("id", sid).single()
      ).data;
      expect(publicRow).not.toHaveProperty("meeting_url");
      await call(B, "register_session", { sid });
      expect(await call(B, "join_details", { sid })).toContain(
        "meet.google.com",
      );
      await call(A, "session_control", { sid, action: "revoke" });
      await expect(call(B, "join_details", { sid })).rejects.toThrow();
    });
    it("requires approval and rejects unauthorized edits and cancellation", async () => {
      const sid = await session({ registration_mode: "approval" });
      expect(await call(B, "register_session", { sid })).toBe("pending");
      await expect(
        call(B, "session_control", { sid, action: "cancel" }),
      ).rejects.toThrow("Host access");
      await call(A, "change_registration", {
        sid,
        target: B.id,
        decision: "approved",
      });
      await call(A, "session_control", { sid, action: "cancel" });
      await expect(call(B, "join_details", { sid })).rejects.toThrow();
    });
    it("restricts discussion and votes to approved participants and emits realtime signals", async () => {
      const sid = await session();
      await expect(
        call(B, "community_action", {
          kind: "message",
          p: { session_id: sid, body: "Hello" },
        }),
      ).rejects.toThrow();
      await call(B, "register_session", { sid });
      await call(B, "community_action", {
        kind: "message",
        p: { session_id: sid, body: "Hello peers" },
      });
      expect(
        (await new Query("session_messages", C).eq("session_id", sid)).data,
      ).toHaveLength(0);
      expect(
        (await new Query("session_messages", A).eq("session_id", sid)).data,
      ).toHaveLength(1);
      expect(
        (await firestore().collection("changes").doc(`session_${sid}`).get())
          .exists,
      ).toBe(true);
      const q = await call(B, "community_action", {
        kind: "question",
        p: { session_id: sid, body: "How does this work?" },
      });
      await call(B, "community_action", { kind: "vote", p: { id: q } });
      await call(B, "community_action", { kind: "vote", p: { id: q } });
      expect(
        (await new Query("question_votes", B).eq("question_id", q)).data,
      ).toHaveLength(0);
    });
    it("serializes proposal acceptance and links the selected host’s session", async () => {
      const req = await call(C, "community_action", {
        kind: "request",
        p: {
          topic: "Binary search trees workshop",
          description: "Please explain deletion and insertion in a tree.",
          category_id: category,
          difficulty: "Beginner",
          language: "English",
          preferred_schedule: "Weekend",
          tags: "trees",
        },
      });
      await call(B, "community_action", { kind: "interest", p: { id: req } });
      const offer = await call(A, "community_action", {
        kind: "propose",
        p: { id: req, body: "I can teach this topic." },
      });
      await call(C, "community_action", {
        kind: "accept_proposal",
        p: { id: offer },
      });
      await expect(
        call(C, "community_action", {
          kind: "accept_proposal",
          p: { id: offer },
        }),
      ).rejects.toThrow("already selected");
      const sid = await session();
      await call(A, "community_action", {
        kind: "link_request",
        p: { id: req, session_id: sid },
      });
      expect(
        (
          await firestore()
            .collection("session_requests")
            .doc(String(req))
            .get()
        ).data()?.session_id,
      ).toBe(sid);
    });
    it("accepts only one helper under concurrency", async () => {
      const did = await call(C, "community_action", {
        kind: "doubt",
        p: {
          topic: "Help with a tree",
          subject: "DSA",
          description: "I am stuck deleting the root node.",
          urgency: "Now",
          expected_minutes: 20,
          difficulty: "Beginner",
          language: "English",
        },
      });
      for (const actor of [A, B])
        await call(actor, "community_action", {
          kind: "volunteer",
          p: { id: did },
        });
      const results = await Promise.allSettled([
        call(C, "community_action", {
          kind: "accept_helper",
          p: { id: did, user_id: A.id },
        }),
        call(C, "community_action", {
          kind: "accept_helper",
          p: { id: did, user_id: B.id },
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    });
    it("guards circle posts and account moderation", async () => {
      const cid = await call(A, "community_action", {
        kind: "circle",
        p: {
          title: "Python Beginners",
          description: "Learn Python together each week.",
          category_id: category,
          rules: "Be kind and curious.",
          membership_mode: "approval",
        },
      });
      await call(B, "community_action", {
        kind: "join_circle",
        p: { id: cid },
      });
      await expect(
        call(B, "community_action", {
          kind: "circle_post",
          p: { circle_id: cid, body: "Hello" },
        }),
      ).rejects.toThrow("membership");
      await call(A, "community_action", {
        kind: "circle_member",
        p: { id: cid, user_id: B.id, status: "approved" },
      });
      await call(B, "community_action", {
        kind: "circle_post",
        p: { circle_id: cid, body: "Hello circle" },
      });
      await expect(
        call(B, "moderate", {
          rid: randomUUID(),
          decision: "dismiss",
          reason: "No issue found",
        }),
      ).rejects.toThrow("Moderator");
    });
    it("rejects direct browser access to private collections using Firestore rules", async () => {
      const response = await fetch(
        `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-peerwave/databases/(default)/documents/session_links`,
      );
      expect(response.status).toBe(403);
    });
  },
);
