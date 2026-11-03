import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { categories, type Session } from "@/lib/data";
import { SessionForm } from "@/features/hosting/session-form";
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { client, user } = await requireUser();
  const { data: s } = await client
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("host_id", user.id)
    .maybeSingle();
  if (!s) notFound();
  const { data: url, error } = await client.rpc("join_details", { sid: id });
  if (error) throw new Error(error.message);
  const { data } = await client
    .from("circle_memberships")
    .select("study_circles(id,title)")
    .eq("user_id", user.id)
    .eq("status", "approved");
  return (
    <div className="page-content">
      <div className="page-head">
        <h1>
          Make it <em>yours.</em>
        </h1>
        <p>Update your session. Registrants receive an in-app update.</p>
      </div>
      <div className="panel">
        <SessionForm
          cats={await categories()}
          session={s as unknown as Session}
          meetingUrl={url}
          circles={(data || []).map(
            (m) => m.study_circles as unknown as { id: string; title: string },
          )}
        />
      </div>
    </div>
  );
}
