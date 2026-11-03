import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
export default async function Onboarding() {
  const { user, profile, client } = await requireUser(false);
  const { data: academic } = await client
    .from("profile_academics")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (
    <div className="page-content">
      <div className="page-head">
        <div className="eyebrow">Make yourself at home</div>
        <h1>
          Your story. <em>Your pace.</em>
        </h1>
        <p>
          A few details help people find the learning partner in you. Academic
          details are optional and private by default.
        </p>
      </div>
      <div className="panel" style={{ maxWidth: 850 }}>
        <ActionForm
          action="profile"
          label="Save my profile"
          redirect="/dashboard"
        >
          <div className="form-grid">
            {[
              ["display_name", "Display name", profile.display_name],
              [
                "username",
                "Username (lowercase letters, numbers, underscore)",
                profile.username,
              ],
              ["language", "Preferred language", profile.language],
              [
                "time_zone",
                "IANA time zone (e.g. Asia/Kolkata)",
                profile.time_zone,
              ],
              ["interests", "Your interests", profile.interests],
              ["skills", "Skills you bring", profile.skills],
              ["learn", "What you want to learn", profile.learn],
              ["teach", "What you can teach", profile.teach],
            ].map(([name, label, value]) => (
              <label key={name} className="field">
                {label}
                <input
                  name={name}
                  defaultValue={value || ""}
                  required={[
                    "display_name",
                    "username",
                    "language",
                    "time_zone",
                  ].includes(name)}
                  maxLength={
                    name === "username"
                      ? 30
                      : name === "display_name"
                        ? 70
                        : 500
                  }
                />
              </label>
            ))}
            <label className="field full">
              A little about you
              <textarea
                name="bio"
                defaultValue={profile.bio}
                maxLength={1000}
              />
            </label>
            {[
              ["college", "College / university"],
              ["course", "Course"],
              ["year", "Year of study"],
            ].map(([name, label]) => (
              <label key={name} className="field">
                {label} · optional
                <input
                  name={name}
                  defaultValue={academic?.[name] || ""}
                  maxLength={name === "year" ? 30 : 150}
                />
              </label>
            ))}
            <label className="check full">
              <input
                name="academic_public"
                type="checkbox"
                defaultChecked={academic?.academic_public}
              />
              Show my academic details on my public profile
            </label>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
