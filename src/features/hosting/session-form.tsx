"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { command } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { type Category, type Session } from "@/lib/data";
import { sessionSchema } from "@/lib/validations";
type Draft = {
  title: string;
  description: string;
  category_id: string;
  subject: string;
  tags: string;
  difficulty: string;
  language: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  capacity: number;
  provider: string;
  meeting_url: string;
  authorized: boolean;
  objectives: string;
  prerequisites: string;
  visibility: string;
  registration_mode: string;
  status: string;
  join_minutes: number;
  circle_id: string;
};
function localInput(date?: string) {
  if (!date) return "";
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function SessionForm({
  cats,
  session,
  meetingUrl = "",
  circles = [],
}: {
  cats: Category[];
  session?: Session;
  meetingUrl?: string;
  circles?: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const { register, handleSubmit, getValues, setValue } = useForm<Draft>({
    defaultValues: {
      title: session?.title || "",
      description: session?.description || "",
      category_id: session?.category_id || cats[0]?.id || "",
      subject: session?.subject || "",
      tags: session?.tags || "",
      difficulty: session?.difficulty || "Beginner",
      language: session?.language || "English",
      starts_at: localInput(session?.starts_at),
      ends_at: localInput(session?.ends_at),
      time_zone:
        session?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      capacity: session?.capacity || 20,
      provider: session?.provider || "Google Meet",
      meeting_url: meetingUrl,
      authorized: false,
      objectives: session?.objectives || "",
      prerequisites: session?.prerequisites || "",
      visibility: session?.visibility || "public",
      registration_mode: session?.registration_mode || "instant",
      status: session?.status === "published" ? "published" : "draft",
      join_minutes: session?.join_minutes ?? 15,
      circle_id: session?.circle_id || "",
    },
  });
  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        setPending(true);
        setMessage("");
        try {
          const payload = sessionSchema.parse({
            ...values,
            ...(session ? { id: session.id } : {}),
            starts_at: new Date(values.starts_at).toISOString(),
            ends_at: new Date(values.ends_at).toISOString(),
          });
          const id = await command("session", payload);
          router.push(`/sessions/${id}`);
          router.refresh();
        } catch (e) {
          setMessage(e instanceof Error ? e.message : "Unable to save");
        } finally {
          setPending(false);
        }
      })}
    >
      <div className="form-grid">
        <label className="field full">
          Give your session a title
          <input
            {...register("title")}
            required
            minLength={8}
            maxLength={140}
            placeholder="Python, one small project at a time"
          />
        </label>
        <label className="field full">
          What will you explore together?
          <textarea
            {...register("description")}
            required
            minLength={30}
            maxLength={4000}
            placeholder="Who is this for? What will learners take away?"
          />
        </label>
        <div className="full" style={{ marginBottom: 20 }}>
          <Button
            type="button"
            variant="outline"
            disabled={assisting}
            onClick={async () => {
              setAssisting(true);
              try {
                const r = await command("assist", {
                  title: getValues("title"),
                  description: getValues("description"),
                });
                setValue("description", r.text);
                setMessage(r.source);
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Assistant unavailable",
                );
              } finally {
                setAssisting(false);
              }
            }}
          >
            {assisting ? "Drafting…" : "Help structure my description"}
          </Button>
          <p className="subtle">
            Uses a structured template unless local Ollama is enabled. Review
            all suggestions.
          </p>
        </div>
        <label className="field">
          Category
          <select {...register("category_id")} required>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Subject
          <input {...register("subject")} required maxLength={100} />
        </label>
        <label className="field">
          Topic tags · comma separated
          <input {...register("tags")} maxLength={200} />
        </label>
        <label className="field">
          Level
          <select {...register("difficulty")}>
            {["Beginner", "Intermediate", "Advanced"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Session language
          <input {...register("language")} required maxLength={50} />
        </label>
        <label className="field">
          Session time zone
          <input {...register("time_zone")} required />
        </label>
        <label className="field">
          Starts · your device’s local time
          <input {...register("starts_at")} type="datetime-local" required />
        </label>
        <label className="field">
          Ends · your device’s local time
          <input {...register("ends_at")} type="datetime-local" required />
        </label>
        <p className="subtle full">
          Dates are entered in your device’s time zone and stored as absolute
          instants. The session time zone is displayed as host context.
        </p>
        <label className="field">
          Maximum participants
          <input
            {...register("capacity", { valueAsNumber: true })}
            type="number"
            min={1}
            max={500}
            required
          />
        </label>
        <label className="field">
          Meeting platform
          <select {...register("provider")}>
            {["Google Meet", "Zoom", "Microsoft Teams"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="field full">
          Private meeting URL
          <input
            {...register("meeting_url")}
            type="url"
            required
            placeholder="https://meet.google.com/abc-defg-hij"
          />
          <small className="muted">
            Only you and approved participants in the join window can retrieve
            this link.
          </small>
        </label>
        <label className="check full">
          <input {...register("authorized")} type="checkbox" required />I
          created this meeting or have permission to distribute its link.
        </label>
        <label className="field">
          Learning objectives
          <textarea {...register("objectives")} maxLength={4000} />
        </label>
        <label className="field">
          Prerequisites · optional
          <textarea {...register("prerequisites")} maxLength={2000} />
        </label>
        <label className="field">
          Visibility
          <select {...register("visibility")}>
            <option value="public">Public — discoverable</option>
            <option value="unlisted">
              Unlisted — visible to anyone with the session page URL
            </option>
            <option value="private">
              Private — existing registrants and host only
            </option>
          </select>
        </label>
        <label className="field">
          Registration
          <select {...register("registration_mode")}>
            <option value="instant">Instant, with waitlist when full</option>
            <option value="approval">Host approval required</option>
          </select>
        </label>
        <label className="field">
          Join window · minutes before start
          <input
            {...register("join_minutes", { valueAsNumber: true })}
            type="number"
            min={0}
            max={1440}
          />
        </label>
        <label className="field">
          Study circle · optional
          <select {...register("circle_id")}>
            <option value="">Independent session</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Publication
          <select {...register("status")}>
            {session?.status !== "published" && (
              <option value="draft">Save as draft</option>
            )}
            <option value="published">Publish session</option>
          </select>
        </label>
      </div>
      <div className="notice">
        Sessions are always free. A scheduled time does not confirm that an
        external meeting is live. Private sessions currently support existing
        registrants; new private invitations are not yet available.
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save session"} ↗
      </Button>
      {message && (
        <p className="form-error" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
