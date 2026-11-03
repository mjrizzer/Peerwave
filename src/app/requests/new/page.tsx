import { requireUser } from "@/lib/auth";
import { categories } from "@/lib/data";
import { ActionForm } from "@/components/action-form";
import { TopicFields } from "@/components/community/topic-fields";
export default async function NewRequest() {
  await requireUser();
  return (
    <div className="page-content">
      <div className="page-head">
        <h1>
          Put your curiosity <em>out there.</em>
        </h1>
        <p>
          The session you wish existed might be someone’s next teaching moment.
        </p>
      </div>
      <div className="panel">
        <ActionForm
          action="request"
          label="Post my request"
          redirect="/requests/:id"
        >
          <TopicFields cats={await categories()} />
        </ActionForm>
      </div>
    </div>
  );
}
