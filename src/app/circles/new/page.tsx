import { requireUser } from "@/lib/auth";
import { categories } from "@/lib/data";
import { ActionForm } from "@/components/action-form";
export default async function NewCircle() {
  await requireUser();
  const cats = await categories();
  return (
    <div className="page-content">
      <div className="page-head">
        <h1>
          A small circle.
          <br />
          <em>A bigger possibility.</em>
        </h1>
      </div>
      <div className="panel">
        <ActionForm
          action="circle"
          label="Create study circle"
          redirect="/circles/:id"
        >
          <label className="field">
            Circle title
            <input name="title" required minLength={3} maxLength={120} />
          </label>
          <label className="field">
            What brings you together?
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={4000}
            />
          </label>
          <label className="field">
            Category
            <select name="category_id">
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Community rules
            <textarea
              name="rules"
              required
              maxLength={4000}
              defaultValue="Be kind. Stay curious. Respect everyone. No spam or unsolicited contact."
            />
          </label>
          <label className="field">
            Membership
            <select name="membership_mode">
              <option value="open">Anyone can join</option>
              <option value="approval">Approve membership requests</option>
            </select>
          </label>
        </ActionForm>
      </div>
    </div>
  );
}
