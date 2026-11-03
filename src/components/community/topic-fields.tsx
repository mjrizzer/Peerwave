import { type Category } from "@/lib/data";
export function TopicFields({
  cats,
  doubt = false,
}: {
  cats?: Category[];
  doubt?: boolean;
}) {
  return (
    <div className="form-grid">
      <label className="field full">
        What would you like to learn?
        <input
          name="topic"
          required
          minLength={5}
          maxLength={140}
          placeholder={
            doubt
              ? "Need help with binary search tree deletion"
              : "A beginner workshop on Git and GitHub"
          }
        />
      </label>
      <label className="field full">
        Tell us a little more
        <textarea name="description" required minLength={10} maxLength={4000} />
      </label>
      {cats && (
        <label className="field">
          Category
          <select name="category_id" required>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        Level
        <select name="difficulty">
          {["Beginner", "Intermediate", "Advanced"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Preferred language
        <input name="language" defaultValue="English" maxLength={50} required />
      </label>
      {doubt ? (
        <>
          <label className="field">
            Subject
            <input name="subject" required maxLength={100} />
          </label>
          <label className="field">
            When would help be useful?
            <select name="urgency">
              <option>Whenever possible</option>
              <option>Today</option>
              <option>Now</option>
            </select>
          </label>
          <label className="field">
            Expected duration · minutes
            <input
              name="expected_minutes"
              type="number"
              min={5}
              max={120}
              defaultValue={20}
              required
            />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            Preferred schedule · optional
            <input
              name="preferred_schedule"
              maxLength={200}
              placeholder="Weekend evenings, IST"
            />
          </label>
          <label className="field">
            Tags · optional
            <input name="tags" maxLength={200} />
          </label>
        </>
      )}
    </div>
  );
}
