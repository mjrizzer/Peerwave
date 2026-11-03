import { ActionForm } from "./action-form";
export function Report({
  id,
  type,
}: {
  id: string;
  type: "session" | "message" | "profile" | "circle_post";
}) {
  return (
    <details>
      <summary>Report a concern</summary>
      <ActionForm
        action="report"
        payload={{ id, target_type: type }}
        label="Submit report"
        reset
      >
        <label className="field">
          What happened?
          <textarea
            name="body"
            required
            minLength={5}
            maxLength={2000}
            placeholder="Spam, unsafe links, harassment, misleading information…"
          />
        </label>
      </ActionForm>
    </details>
  );
}
