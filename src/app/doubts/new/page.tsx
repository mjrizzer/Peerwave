import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { TopicFields } from "@/components/community/topic-fields";
export default async function NewDoubt() {
  await requireUser();
  return (
    <div className="page-content">
      <div className="page-head">
        <h1>
          Let’s work <em>through it.</em>
        </h1>
        <p>
          Explain where you got stuck. Requests expire after 24 hours if no
          helper is selected.
        </p>
      </div>
      <div className="panel">
        <ActionForm action="doubt" label="Post my doubt" redirect="/doubts/:id">
          <TopicFields doubt />
        </ActionForm>
      </div>
    </div>
  );
}
