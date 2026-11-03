import { randomUUID } from "node:crypto";
import {
  Store,
  transaction,
  student,
  staff,
  member,
  blocked,
  circleMember,
  canRead,
  throttle,
  notify,
  key,
  now,
  type Actor,
  type Row,
} from "./store";
import { profileSchema, sessionSchema } from "@/lib/validations";
import { commands } from "@/lib/validations/commands";
import { validMeetingUrl } from "@/lib/security/meeting-url";
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function promote(s: Store, session: Row) {
  if (session.status !== "published" || session.ends_at <= now()) return;
  let count = session.approved_count || 0;
  for (const r of await s.waitlist(session.id, session.capacity - count)) {
    if (count >= session.capacity) break;
    await s.patch("registrations", r.id, { status: "approved" });
    count++;
    await notify(
      s,
      r.user_id,
      "registration_approved",
      `A place opened up in ${session.title}`,
      `/sessions/${session.id}`,
    );
  }
  await s.patch("sessions", session.id, {
    approved_count: count,
    updated_at: now(),
  });
}
export async function executeRpc(actor: Actor, name: string, args: Row = {}) {
  if (
    [
      "is_staff",
      "is_admin",
      "session_capacity",
      "join_details",
      "doubt_join_details",
    ].includes(name)
  ) {
    const s = new Store();
    if (name === "is_staff" || name === "is_admin")
      return staff(s, actor, name === "is_admin");
    if (name === "doubt_join_details") {
      await student(s, actor);
      const d = await s.get("instant_doubt_requests", args.did);
      ensure(
        d &&
          d.status === "accepted" &&
          [d.creator_id, d.helper_id].includes(actor!.id) &&
          !(await blocked(s, actor, d.creator_id)) &&
          !(await blocked(s, actor, d.helper_id)),
        "Only selected participants may join",
      );
      const link = await s.get("doubt_links", args.did);
      ensure(link, "A participant must share an authorized link first");
      return link.meeting_url;
    }
    const session = await s.get("sessions", args.sid);
    ensure(
      session && (await canRead(s, actor, "sessions", session)),
      "Session unavailable",
    );
    if (name === "session_capacity")
      return Math.max(0, session.capacity - (session.approved_count || 0));
    await student(s, actor);
    const link = await s.get("session_links", session.id);
    ensure(link, "Joining details unavailable");
    if (session.host_id === actor!.id) return link.meeting_url;
    ensure(
      session.status === "published" &&
        !link.revoked &&
        (await member(s, actor, session.id)) &&
        !(await blocked(s, actor, session.host_id)) &&
        Date.now() >=
          Date.parse(session.starts_at) - session.join_minutes * 60000 &&
        Date.now() <= Date.parse(session.ends_at),
      "Joining details are available only to approved participants during the join window",
    );
    return link.meeting_url;
  }
  return transaction(async (s) => {
    if (name === "save_profile") {
      ensure(actor, "Sign in first");
      const p = profileSchema.parse(args.p);
      const existing = (await s.list("profiles", "username", p.username)).find(
        (r) => r.id !== actor.id,
      );
      ensure(!existing, "That username is already taken");
      const username = await s.get("usernames", p.username);
      ensure(
        !username || username.user_id === actor.id,
        "That username is already taken",
      );
      const old = await s.get("profiles", actor.id);
      if (old?.username && old.username !== p.username)
        s.delete("usernames", old.username);
      s.set("usernames", p.username, { user_id: actor.id });
      const { college, course, year, academic_public, ...publicFields } = p;
      s.set("profiles", actor.id, {
        ...old,
        ...publicFields,
        onboarded: true,
        suspended: old?.suspended || false,
        created_at: old?.created_at || now(),
      });
      s.set("profile_academics", actor.id, {
        user_id: actor.id,
        college,
        course,
        year,
        academic_public,
      });
      return null;
    }
    const uid = await student(s, actor);
    if (name === "ai_allow") {
      await throttle(s, uid, "assistant", 20);
      return null;
    }
    if (name === "save_session") {
      await throttle(s, uid, "hosting", 30);
      const p = sessionSchema.parse(args.p);
      const sid = p.id || randomUUID();
      const old = await s.get("sessions", sid);
      ensure(
        !old ||
          (old.host_id === uid &&
            old.status !== "cancelled" &&
            old.ends_at > now()),
        "You cannot edit this session",
      );
      ensure(
        !old || old.status !== "published" || p.status === "published",
        "Published sessions cannot return to draft",
      );
      ensure(
        !old || p.capacity >= (old.approved_count || 0),
        "Capacity cannot be below approved registrations",
      );
      ensure(
        await s.get("categories", p.category_id),
        "Choose an existing category",
      );
      if (p.circle_id)
        ensure(
          await circleMember(s, actor, p.circle_id),
          "Join this circle first",
        );
      const { meeting_url, authorized: permission, ...metadata } = p;
      ensure(permission, "Confirm permission");
      const session = {
        ...old,
        ...metadata,
        id: sid,
        circle_id: p.circle_id || null,
        host_id: uid,
        approved_count: old?.approved_count || 0,
        registration_closed: old?.registration_closed || false,
        created_at: old?.created_at || now(),
        updated_at: now(),
      };
      s.set("sessions", sid, session);
      s.set("session_links", sid, {
        session_id: sid,
        meeting_url,
        revoked: false,
        updated_at: now(),
      });
      if (old)
        for (const r of await s.list("registrations", "session_id", sid))
          if (["approved", "pending", "waitlisted"].includes(r.status))
            await notify(
              s,
              r.user_id,
              "session_changed",
              `The host updated ${p.title}`,
              `/sessions/${sid}`,
            );
      await promote(s, session);
      s.set("audit_logs", randomUUID(), {
        actor_id: uid,
        action: "session_saved",
        target_id: sid,
        created_at: now(),
      });
      return sid;
    }
    if (name === "register_session") {
      await throttle(s, uid, "registration", 60);
      const session = await s.get("sessions", args.sid);
      ensure(
        session &&
          (await canRead(s, actor, "sessions", session)) &&
          session.status === "published" &&
          !session.registration_closed &&
          session.ends_at > now() &&
          session.host_id !== uid &&
          !(await blocked(s, actor, session.host_id)),
        "This session is not available for registration",
      );
      const rid = key(session.id, uid);
      const old = await s.get("registrations", rid);
      ensure(
        !old || !["removed", "rejected"].includes(old.status),
        "The host has declined your participation",
      );
      if (old && ["approved", "pending", "waitlisted"].includes(old.status))
        return old.status;
      const status =
        session.registration_mode === "approval"
          ? "pending"
          : session.approved_count >= session.capacity
            ? "waitlisted"
            : "approved";
      s.set("registrations", rid, {
        session_id: session.id,
        user_id: uid,
        status,
        created_at: now(),
      });
      await s.patch("sessions", session.id, {
        approved_count:
          (session.approved_count || 0) + (status === "approved" ? 1 : 0),
        updated_at: now(),
      });
      await notify(
        s,
        uid,
        `registration_${status}`,
        `Your registration for ${session.title} is ${status}`,
        `/sessions/${session.id}`,
      );
      return status;
    }
    if (name === "change_registration") {
      const session = await s.get("sessions", args.sid);
      const rid = key(args.sid, args.target);
      const r = await s.get("registrations", rid);
      ensure(session && r, "Registration not found");
      ensure(
        (args.decision === "cancelled" && uid === args.target) ||
          (session.host_id === uid &&
            ["approved", "rejected", "removed"].includes(args.decision)),
        "Not authorized",
      );
      if (args.decision === "approved") {
        ensure(
          ["pending", "waitlisted"].includes(r.status) &&
            session.status === "published" &&
            session.ends_at > now(),
          "Cannot approve this registration",
        );
        ensure(
          session.approved_count < session.capacity,
          "This session is full",
        );
      }
      await s.patch("registrations", rid, { status: args.decision });
      session.approved_count =
        (session.approved_count || 0) +
        (args.decision === "approved" ? 1 : 0) -
        (r.status === "approved" ? 1 : 0);
      await s.patch("sessions", session.id, {
        approved_count: session.approved_count,
      });
      await promote(s, session);
      await notify(
        s,
        args.target,
        `registration_${args.decision}`,
        `Your registration is now ${args.decision}`,
        `/sessions/${session.id}`,
      );
      return null;
    }
    if (name === "session_control") {
      const session = await s.get("sessions", args.sid);
      ensure(session?.host_id === uid, "Host access required");
      if (args.action === "cancel") {
        await s.patch("sessions", session.id, {
          status: "cancelled",
          updated_at: now(),
        });
        await s.patch("session_links", session.id, { revoked: true });
        for (const r of await s.list("registrations", "session_id", session.id))
          if (["approved", "pending", "waitlisted"].includes(r.status))
            await notify(
              s,
              r.user_id,
              "session_cancelled",
              `${session.title} was cancelled`,
              `/sessions/${session.id}`,
            );
      } else if (args.action === "close" || args.action === "reopen") {
        ensure(
          args.action === "close" ||
            (session.status === "published" && session.ends_at > now()),
          "Session cannot reopen",
        );
        await s.patch("sessions", session.id, {
          registration_closed: args.action === "close",
        });
      } else if (args.action === "revoke")
        await s.patch("session_links", session.id, { revoked: true });
      else throw new Error("Invalid action");
      s.set("audit_logs", randomUUID(), {
        actor_id: uid,
        action: args.action,
        target_id: session.id,
        created_at: now(),
      });
      return null;
    }
    if (name === "moderate") {
      ensure(
        (await staff(s, actor)) &&
          typeof args.reason === "string" &&
          args.reason.length >= 5,
        "Moderator access and a reason required",
      );
      const r = await s.get("reports", args.rid);
      ensure(r, "Report unavailable");
      if (args.decision === "remove") {
        if (r.target_type === "session") {
          await s.patch("sessions", r.target_id, { status: "cancelled" });
          await s.patch("session_links", r.target_id, { revoked: true });
        } else if (r.target_type === "message")
          s.delete("session_messages", r.target_id);
        else if (r.target_type === "circle_post")
          s.delete("circle_posts", r.target_id);
        else throw new Error("Use suspend for account reports");
      } else if (args.decision === "suspend") {
        ensure(
          (await staff(s, actor, true)) &&
            r.target_type === "profile" &&
            r.target_id !== uid,
          "Administrator access required",
        );
        await s.patch("profiles", r.target_id, { suspended: true });
      } else ensure(args.decision === "dismiss", "Invalid decision");
      await s.patch("reports", r.id, { status: "reviewed" });
      s.set("moderation_actions", randomUUID(), {
        actor_id: uid,
        report_id: r.id,
        action: args.decision,
        reason: args.reason,
        created_at: now(),
      });
      s.set("audit_logs", randomUUID(), {
        actor_id: uid,
        action: `moderation_${args.decision}`,
        target_id: r.target_id,
        created_at: now(),
      });
      return null;
    }
    if (name === "manage_category") {
      ensure(await staff(s, actor, true), "Administrator access required");
      ensure(
        typeof args.label === "string" &&
          args.label.length >= 2 &&
          args.label.length <= 80 &&
          /^[a-z0-9-]{2,80}$/.test(args.slug_value),
        "Invalid category",
      );
      const cid = args.cid || randomUUID();
      const duplicate = (
        await s.list("categories", "slug", args.slug_value)
      ).find((c) => c.id !== cid);
      ensure(!duplicate, "Category slug already exists");
      s.set("categories", cid, {
        name: args.label,
        slug: args.slug_value,
        active: !!args.enabled,
      });
      s.set("audit_logs", randomUUID(), {
        actor_id: uid,
        action: "category_saved",
        target_id: cid,
        created_at: now(),
      });
      return null;
    }
    ensure(name === "community_action", "Unknown operation");
    const kind = args.kind;
    ensure(commands[kind], "Unknown action");
    const p = commands[kind].parse(args.p) as Row;
    await throttle(
      s,
      uid,
      kind === "report" ? "reports" : "community",
      kind === "report" ? 10 : 100,
    );
    const target = p.id;
    const result = randomUUID();
    if (kind === "message" || kind === "question") {
      ensure(
        await member(s, actor, p.session_id),
        "Approved registration required",
      );
      if (kind === "message") {
        if (p.parent_id)
          ensure(
            (await s.get("session_messages", p.parent_id))?.session_id ===
              p.session_id,
            "Reply must belong to this session",
          );
        if (p.announcement)
          ensure(
            (await s.get("sessions", p.session_id))?.host_id === uid,
            "Only hosts can post announcements",
          );
        s.set("session_messages", result, {
          session_id: p.session_id,
          user_id: uid,
          body: p.body,
          parent_id: p.parent_id || null,
          announcement: !!p.announcement,
          created_at: now(),
          edited_at: null,
        });
        if (p.parent_id) {
          const parent = await s.get("session_messages", p.parent_id);
          if (
            parent &&
            parent.user_id !== uid &&
            !(await blocked(s, actor, parent.user_id))
          )
            await notify(
              s,
              parent.user_id,
              "reply_received",
              "Someone replied to your message",
              `/sessions/${p.session_id}`,
            );
        }
      } else
        s.set("session_questions", result, {
          session_id: p.session_id,
          user_id: uid,
          body: p.body,
          answer: null,
          resolved: false,
          pinned: false,
          created_at: now(),
        });
    } else if (["edit_message", "delete_message", "react"].includes(kind)) {
      const m = await s.get("session_messages", target);
      ensure(
        m && (await member(s, actor, m.session_id)),
        "Message unavailable",
      );
      if (kind === "react")
        await toggle(s, "message_reactions", key(target, uid), {
          message_id: target,
          user_id: uid,
          session_id: m.session_id,
        });
      else if (kind === "edit_message") {
        ensure(m.user_id === uid, "Not authorized");
        await s.patch("session_messages", target, {
          body: p.body,
          edited_at: now(),
        });
      } else {
        ensure(
          m.user_id === uid ||
            (await s.get("sessions", m.session_id))?.host_id === uid ||
            (await staff(s, actor)),
          "Not authorized",
        );
        s.delete("session_messages", target);
        for (const reply of await s.list(
          "session_messages",
          "parent_id",
          target,
        ))
          s.delete("session_messages", reply.id);
      }
    } else if (["vote", "answer", "resolve", "pin"].includes(kind)) {
      const q = await s.get("session_questions", target);
      ensure(
        q && (await member(s, actor, q.session_id)),
        "Question unavailable",
      );
      const host = (await s.get("sessions", q.session_id))?.host_id === uid;
      if (kind === "vote")
        await toggle(s, "question_votes", key(target, uid), {
          question_id: target,
          user_id: uid,
          session_id: q.session_id,
        });
      else if (kind === "resolve") {
        ensure(host || q.user_id === uid, "Host or question owner required");
        await s.patch("session_questions", target, { resolved: !q.resolved });
      } else {
        ensure(host, "Host access required");
        if (kind === "pin")
          await s.patch("session_questions", target, { pinned: !q.pinned });
        else {
          await s.patch("session_questions", target, {
            answer: p.body,
            resolved: true,
          });
          await notify(
            s,
            q.user_id,
            "question_answered",
            "Your question has an answer",
            `/sessions/${q.session_id}`,
          );
        }
      }
    } else if (kind === "request") {
      ensure(await s.get("categories", p.category_id), "Category unavailable");
      s.set("session_requests", result, {
        ...p,
        creator_id: uid,
        session_id: null,
        created_at: now(),
      });
    } else if (kind === "interest") {
      ensure(await s.get("session_requests", target), "Request unavailable");
      await toggle(s, "request_interests", key(target, uid), {
        request_id: target,
        user_id: uid,
      });
    } else if (kind === "propose") {
      ensure(await s.get("session_requests", target), "Request unavailable");
      const proposal = await s.get("host_proposals", key(target, uid));
      ensure(
        !proposal || proposal.status === "pending",
        "A decision was already made",
      );
      s.set("host_proposals", key(target, uid), {
        request_id: target,
        host_id: uid,
        note: p.body,
        status: "pending",
        created_at: proposal?.created_at || now(),
      });
      return key(target, uid);
    } else if (kind === "accept_proposal") {
      const proposal = await s.get("host_proposals", target);
      ensure(proposal, "Proposal unavailable");
      const req = await s.get("session_requests", proposal.request_id);
      ensure(
        req?.creator_id === uid && !req.session_id,
        "Only the requester can select a host",
      );
      ensure(!req.accepted_proposal_id, "A host is already selected");
      await s.patch("session_requests", req.id, {
        accepted_proposal_id: target,
      });
      for (const offer of await s.list("host_proposals", "request_id", req.id))
        await s.patch("host_proposals", offer.id, {
          status: offer.id === target ? "accepted" : "rejected",
        });
      await notify(
        s,
        proposal.host_id,
        "request_accepted",
        "Your proposal was accepted. Create a session and link it to this request.",
        `/requests/${req.id}`,
      );
    } else if (kind === "link_request") {
      const req = await s.get("session_requests", target);
      const offer = await s.get("host_proposals", key(target, uid));
      const session = await s.get("sessions", p.session_id);
      ensure(
        req &&
          !req.session_id &&
          offer?.status === "accepted" &&
          session?.host_id === uid &&
          session.status === "published" &&
          session.visibility === "public",
        "An accepted host must link their published public session",
      );
      await s.patch("session_requests", target, { session_id: session.id });
      for (const r of await s.list("request_interests", "request_id", target))
        await notify(
          s,
          r.user_id,
          "request_scheduled",
          "A workshop you requested is scheduled",
          `/sessions/${session.id}`,
        );
    } else if (kind === "doubt")
      s.set("instant_doubt_requests", result, {
        ...p,
        creator_id: uid,
        status: "pending",
        helper_id: null,
        created_at: now(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      });
    else if (
      [
        "volunteer",
        "accept_helper",
        "resolve_doubt",
        "cancel_doubt",
        "doubt_link",
      ].includes(kind)
    ) {
      const d = await s.get("instant_doubt_requests", target);
      ensure(d, "Request unavailable");
      if (kind === "volunteer") {
        ensure(
          d.creator_id !== uid &&
            d.status === "pending" &&
            d.expires_at > now() &&
            !(await blocked(s, actor, d.creator_id)),
          "This doubt is no longer accepting volunteers",
        );
        s.set("doubt_volunteers", key(target, uid), {
          doubt_id: target,
          user_id: uid,
          created_at: now(),
        });
      } else if (kind === "accept_helper") {
        ensure(
          d.creator_id === uid &&
            d.status === "pending" &&
            d.expires_at > now() &&
            (await s.get("doubt_volunteers", key(target, p.user_id))),
          "This action is not permitted",
        );
        await s.patch("instant_doubt_requests", target, {
          helper_id: p.user_id,
          status: "accepted",
        });
      } else if (kind === "doubt_link") {
        ensure(
          [d.creator_id, d.helper_id].includes(uid) &&
            d.status === "accepted" &&
            p.authorized &&
            validMeetingUrl(p.meeting_url),
          "This action is not permitted",
        );
        s.set("doubt_links", target, {
          doubt_id: target,
          meeting_url: p.meeting_url,
        });
      } else {
        ensure(
          d.creator_id === uid &&
            (kind === "resolve_doubt"
              ? d.status === "accepted"
              : ["pending", "accepted"].includes(d.status)),
          "This action is not permitted",
        );
        await s.patch("instant_doubt_requests", target, {
          status: kind === "resolve_doubt" ? "resolved" : "cancelled",
        });
      }
    } else if (kind === "circle") {
      ensure(await s.get("categories", p.category_id), "Category unavailable");
      s.set("study_circles", result, {
        ...p,
        owner_id: uid,
        created_at: now(),
      });
      s.set("circle_memberships", key(result, uid), {
        circle_id: result,
        user_id: uid,
        status: "approved",
        role: "moderator",
        created_at: now(),
      });
    } else if (kind === "join_circle") {
      const c = await s.get("study_circles", target);
      ensure(c, "Circle unavailable");
      const m = await s.get("circle_memberships", key(target, uid));
      ensure(m?.status !== "removed", "Membership removed by moderator");
      if (!m)
        s.set("circle_memberships", key(target, uid), {
          circle_id: target,
          user_id: uid,
          status: c.membership_mode === "open" ? "approved" : "pending",
          role: "member",
          created_at: now(),
        });
    } else if (kind === "circle_member") {
      ensure(
        (await circleMember(s, actor, target, true)) &&
          (await s.get("study_circles", target))?.owner_id !== p.user_id,
        "Not authorized",
      );
      await s.patch("circle_memberships", key(target, p.user_id), {
        status: p.status,
      });
    } else if (kind === "circle_post") {
      ensure(
        await circleMember(s, actor, p.circle_id),
        "Approved circle membership required",
      );
      s.set("circle_posts", result, { ...p, user_id: uid, created_at: now() });
    } else if (kind === "delete_post") {
      const post = await s.get("circle_posts", target);
      ensure(
        post &&
          (post.user_id === uid ||
            (await circleMember(s, actor, post.circle_id, true)) ||
            (await staff(s, actor))),
        "Not authorized",
      );
      s.delete("circle_posts", target);
    } else if (kind === "follow") {
      ensure(
        uid !== target &&
          (await s.get("profiles", target)) &&
          !(await blocked(s, actor, target)),
        "This connection is unavailable",
      );
      const added = await toggle(s, "follows", key(uid, target), {
        follower_id: uid,
        followed_id: target,
      });
      if (added)
        await notify(
          s,
          target,
          "new_follower",
          "A learner followed your profile",
          `/people/${uid}`,
        );
    } else if (kind === "follow_topic") {
      ensure(await s.get("categories", target), "Category unavailable");
      await toggle(s, "topic_follows", key(uid, target), {
        user_id: uid,
        category_id: target,
      });
    } else if (kind === "save") {
      const session = await s.get("sessions", target);
      ensure(
        session && (await canRead(s, actor, "sessions", session)),
        "Session unavailable",
      );
      await toggle(s, "saved_sessions", key(uid, target), {
        user_id: uid,
        session_id: target,
      });
    } else if (kind === "review") {
      const session = await s.get("sessions", target);
      const r = await s.get("registrations", key(target, uid));
      ensure(
        session &&
          session.status === "published" &&
          session.ends_at < now() &&
          session.host_id !== uid &&
          r?.status === "approved",
        "Only approved participants may review completed sessions",
      );
      ensure(
        !(await s.get("host_reviews", key(target, uid))),
        "You have already reviewed this session",
      );
      s.set("host_reviews", key(target, uid), {
        session_id: target,
        user_id: uid,
        rating: p.rating,
        feedback: p.body,
        relevance: p.relevance,
        clarity: p.clarity,
        helpfulness: p.helpfulness,
        created_at: now(),
      });
    } else if (kind === "report") {
      const table = (
        {
          session: "sessions",
          message: "session_messages",
          profile: "profiles",
          circle_post: "circle_posts",
        } as Record<string, string>
      )[p.target_type];
      const row = await s.get(table, target);
      ensure(
        row && (await canRead(s, actor, table, row)),
        "Report target unavailable",
      );
      s.set("reports", result, {
        reporter_id: uid,
        target_type: p.target_type,
        target_id: target,
        reason: p.body,
        status: "open",
        created_at: now(),
      });
    } else if (kind === "block") {
      ensure(
        uid !== target && (await s.get("profiles", target)),
        "User unavailable",
      );
      const added = await toggle(s, "user_blocks", key(uid, target), {
        user_id: uid,
        blocked_id: target,
      });
      if (added) {
        s.delete("follows", key(uid, target));
        s.delete("follows", key(target, uid));
      }
    } else if (kind === "read_notifications") {
      for (const n of await s.list("notifications", "user_id", uid))
        if (!target || n.id === target)
          await s.patch("notifications", n.id, { read_at: now() });
    } else if (kind === "mute_notifications")
      s.set("notification_preferences", uid, { user_id: uid, muted: p.muted });
    else throw new Error("Unknown action");
    return result;
  });
}
async function toggle(s: Store, table: string, id: string, value: Row) {
  if (await s.get(table, id)) {
    s.delete(table, id);
    return false;
  }
  s.set(table, id, value);
  return true;
}
