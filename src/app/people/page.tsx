import Link from "next/link";
import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { SetupNotice } from "@/components/setup-notice";
export default async function People() {
  let people: {
    id: string;
    display_name: string;
    interests: string;
    teach: string;
  }[] = [];
  if (configured()) {
    const client = await db();
    const { data, error } = await client
      .from("profiles")
      .select("id,display_name,interests,teach")
      .eq("onboarded", true)
      .eq("suspended", false)
      .limit(60);
    if (error) throw new Error(error.message);
    people = (data || []) as unknown as typeof people;
  }
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">Your people are out there</div>
        <h1>
          Different paths.
          <br />
          <em>Shared curiosity.</em>
        </h1>
        <p>
          Find a familiar interest, a new perspective, or someone to learn
          alongside.
        </p>
      </div>
      {!configured() && <SetupNotice />}
      <div className="grid-3">
        {people.map((p) => (
          <Link className="panel" href={`/people/${p.id}`} key={p.id}>
            <div className="person">
              <span className="avatar">{p.display_name[0]}</span>
              <h3>{p.display_name}</h3>
            </div>
            <p className="muted" style={{ marginTop: 20 }}>
              {p.interests || "A curious mind."}
            </p>
            <small>{p.teach && `Happy to share: ${p.teach}`}</small>
          </Link>
        ))}
      </div>
      {!people.length && (
        <div className="empty">
          <h3>A new community, waiting to happen.</h3>
          <p>Create your profile and help shape it.</p>
        </div>
      )}
    </div>
  );
}
