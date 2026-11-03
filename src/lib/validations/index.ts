import { z } from "zod";
import { providerMatches, providers } from "@/lib/security/meeting-url";
export const id = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{10,160}$/, "Invalid identifier");
export const text = z.string().trim().min(1).max(4000);
export const sessionSchema = z
  .object({
    id: id.optional(),
    title: z.string().trim().min(8).max(140),
    description: text.min(30),
    category_id: id,
    subject: z.string().trim().min(2).max(100),
    tags: z.string().max(200).default(""),
    difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
    language: z.string().trim().min(2).max(50),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    time_zone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid IANA time zone"),
    capacity: z.coerce.number().int().min(1).max(500),
    provider: z.enum(providers),
    meeting_url: z.string(),
    authorized: z.literal(true),
    objectives: z.string().max(4000).default(""),
    prerequisites: z.string().max(2000).default(""),
    visibility: z.enum(["public", "unlisted", "private"]),
    registration_mode: z.enum(["instant", "approval"]),
    status: z.enum(["draft", "published"]),
    join_minutes: z.coerce.number().int().min(0).max(1440),
    circle_id: z.union([id, z.literal("")]).default(""),
  })
  .refine((v) => new Date(v.ends_at) > new Date(v.starts_at), {
    message: "End must be after start",
    path: ["ends_at"],
  })
  .refine((v) => new Date(v.starts_at).getTime() > Date.now(), {
    message: "Choose a future start time",
    path: ["starts_at"],
  })
  .refine((v) => providerMatches(v.meeting_url, v.provider), {
    message: "Use a direct, approved meeting URL matching the provider",
    path: ["meeting_url"],
  });
export const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(70),
  username: z.string().regex(/^[a-z0-9_]{3,30}$/),
  bio: z.string().max(1000),
  interests: z.string().max(500),
  skills: z.string().max(500),
  learn: z.string().max(500),
  teach: z.string().max(500),
  language: z.string().min(2).max(50),
  time_zone: z.string().max(100),
  college: z.string().max(150),
  course: z.string().max(150),
  year: z.string().max(30),
  academic_public: z.boolean(),
});
