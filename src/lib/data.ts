import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
export type Category = { id: string; name: string; slug: string };
export type Session = {
  id: string;
  host_id: string;
  title: string;
  description: string;
  subject: string;
  tags: string;
  category_id: string;
  difficulty: string;
  language: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  provider: string;
  visibility: string;
  status: string;
  registration_mode: string;
  registration_closed: boolean;
  objectives: string;
  prerequisites: string;
  join_minutes: number;
  time_zone: string;
  circle_id: string | null;
  categories?: { name: string } | null;
  profiles?: { display_name: string } | null;
};
export async function categories(): Promise<Category[]> {
  if (!configured()) return [];
  const client = await db();
  const { data, error } = await client
    .from("categories")
    .select("id,name,slug")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Category[];
}
export function lifecycle(
  s: Pick<Session, "status" | "starts_at" | "ends_at">,
  now = Date.now(),
) {
  if (s.status === "draft" || s.status === "cancelled") return s.status;
  if (new Date(s.ends_at).getTime() < now) return "Completed";
  if (new Date(s.starts_at).getTime() <= now) return "In scheduled time window";
  if (new Date(s.starts_at).getTime() - now < 15 * 60000)
    return "Starting soon";
  return "Upcoming";
}
