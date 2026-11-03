import { requireUser } from "@/lib/auth";
import { categories } from "@/lib/data";
import { SessionForm } from "@/features/hosting/session-form";
export default async function Host() {
  const { client, user } = await requireUser();
  const cats = await categories();
  const { data } = await client
    .from("circle_memberships")
    .select("study_circles(id,title)")
    .eq("user_id", user.id)
    .eq("status", "approved");
  const circles = (data || []).map(
    (m) => m.study_circles as unknown as { id: string; title: string },
  );
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">A little knowledge goes a long way</div>
        <h1>
          Share what <em>you know.</em>
        </h1>
        <p>Make it welcoming. Keep it useful. Let curiosity do the rest.</p>
      </div>
      <div className="panel" style={{ maxWidth: 900 }}>
        <SessionForm cats={cats} circles={circles} />
      </div>
    </div>
  );
}
