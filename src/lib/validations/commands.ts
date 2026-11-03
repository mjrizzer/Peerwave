import { z } from "zod";
import { id, text } from "./index";
import { validMeetingUrl } from "@/lib/security/meeting-url";
const body = z.object({ body: text });
const target = z.object({ id });
const topic = z.object({
  topic: z.string().trim().min(5).max(140),
  description: text.min(10),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  language: z.string().min(2).max(50),
});
export const commands: Record<string, z.ZodType> = {
  message: body.extend({
    session_id: id,
    parent_id: z.union([id, z.literal("")]).optional(),
    announcement: z.boolean().optional(),
  }),
  question: body.extend({ session_id: id }),
  edit_message: target.extend({ body: text }),
  delete_message: target,
  react: target,
  vote: target,
  answer: target.extend({ body: text }),
  resolve: target,
  pin: target,
  request: topic.extend({
    category_id: id,
    preferred_schedule: z.string().max(200),
    tags: z.string().max(200),
  }),
  interest: target,
  propose: target.extend({ body: text.min(5).max(1000) }),
  accept_proposal: target,
  link_request: target.extend({ session_id: id }),
  doubt: topic.extend({
    subject: z.string().min(2).max(100),
    urgency: z.enum(["Whenever possible", "Today", "Now"]),
    expected_minutes: z.coerce.number().int().min(5).max(120),
  }),
  volunteer: target,
  accept_helper: target.extend({ user_id: id }),
  resolve_doubt: target,
  cancel_doubt: target,
  doubt_link: target.extend({
    meeting_url: z
      .string()
      .refine(validMeetingUrl, "Use an approved direct HTTPS meeting URL"),
    authorized: z.literal(true),
  }),
  circle: z.object({
    title: z.string().min(3).max(120),
    description: text.min(10),
    category_id: id,
    rules: text,
    membership_mode: z.enum(["open", "approval"]),
  }),
  join_circle: target,
  circle_member: target.extend({
    user_id: id,
    status: z.enum(["approved", "removed"]),
  }),
  circle_post: body.extend({ circle_id: id }),
  delete_post: target,
  follow: target,
  follow_topic: target,
  save: target,
  review: target.extend({
    rating: z.coerce.number().int().min(1).max(5),
    body: z.string().max(2000),
    relevance: z.coerce.number().int().min(1).max(5),
    clarity: z.coerce.number().int().min(1).max(5),
    helpfulness: z.coerce.number().int().min(1).max(5),
  }),
  report: target.extend({
    body: text.min(5).max(2000),
    target_type: z.enum(["session", "message", "profile", "circle_post"]),
  }),
  block: target,
  read_notifications: z.object({ id: id.optional() }),
  mute_notifications: z.object({ muted: z.boolean() }),
};
