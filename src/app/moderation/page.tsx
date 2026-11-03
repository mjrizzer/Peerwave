import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { LocalTime } from "@/components/local-time";
export default async function Moderation() {
  const { client } = await requireUser();
  const { data: staff } = await client.rpc("is_staff");
  if (!staff) notFound();
  const { data: admin } = await client.rpc("is_admin");
  const [reports, history, cats] = await Promise.all([
    client
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("moderation_actions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    client.from("categories").select("*").order("name"),
  ]);
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">Care for the community</div>
        <h1>
          Keep this a <em>welcoming place.</em>
        </h1>
        <p>
          Review context carefully. Every moderation action requires a reason
          and is recorded.
        </p>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2 style={{ fontSize: 30 }}>Reports</h2>
          {reports.data?.map((r) => (
            <div className="list-row" key={r.id}>
              <span className="badge">
                {r.status} · {r.target_type}
              </span>
              <p>{r.reason}</p>
              <p className="subtle">Target: {r.target_id}</p>
              {r.status === "open" && (
                <ActionForm
                  action="moderate"
                  payload={{ id: r.id }}
                  label="Apply decision"
                >
                  <label className="field">
                    Decision
                    <select name="decision">
                      <option value="dismiss">Reviewed — no removal</option>
                      {r.target_type !== "profile" && (
                        <option value="remove">
                          Remove content / cancel session
                        </option>
                      )}
                      {admin && r.target_type === "profile" && (
                        <option value="suspend">Suspend account</option>
                      )}
                    </select>
                  </label>
                  <label className="field">
                    Reason
                    <textarea
                      name="reason"
                      required
                      minLength={5}
                      maxLength={2000}
                    />
                  </label>
                </ActionForm>
              )}
            </div>
          ))}
          {!reports.data?.length && (
            <p className="muted">No reports to review.</p>
          )}
        </section>
        <section className="panel">
          <h2 style={{ fontSize: 30 }}>Moderation history</h2>
          {history.data?.map((a) => (
            <div key={a.id} className="list-row">
              <strong>{a.action}</strong>
              <p>{a.reason}</p>
              <small>
                <LocalTime value={a.created_at} />
              </small>
            </div>
          ))}
        </section>
      </div>
      {admin && (
        <section className="detail-section panel">
          <h2>Category management</h2>
          <ActionForm
            action="category"
            payload={{ active: true }}
            label="Create category"
          >
            <div className="form-grid">
              <label className="field">
                Name
                <input name="name" required minLength={2} maxLength={80} />
              </label>
              <label className="field">
                Slug
                <input name="slug" required pattern="[a-z0-9-]{2,80}" />
              </label>
            </div>
          </ActionForm>
          {cats.data?.map((c) => (
            <ActionForm
              key={c.id}
              action="category"
              payload={{
                id: c.id,
                name: c.name,
                slug: c.slug,
                active: !c.active,
              }}
              label={`${c.active ? "Disable" : "Enable"} ${c.name}`}
              className="inline"
            />
          ))}
        </section>
      )}
    </div>
  );
}
