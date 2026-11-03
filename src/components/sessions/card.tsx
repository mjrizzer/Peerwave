import Link from "next/link";
import { Clock, ArrowUpRight } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { lifecycle, type Session } from "@/lib/data";
export function SessionCard({ session: s }: { session: Session }) {
  return (
    <article className="card">
      <div className="card-art" aria-hidden="true">
        <span>{s.subject.toLowerCase().includes("cod") ? "</>" : "Aa"}</span>
        <span>PEER / SESSION</span>
      </div>
      <div className="card-body">
        <span className="badge">{s.categories?.name || s.subject}</span>
        <h3>
          <Link href={`/sessions/${s.id}`}>{s.title}</Link>
        </h3>
        <p>
          {s.description.slice(0, 120)}
          {s.description.length > 120 ? "…" : ""}
        </p>
        <div className="meta">
          <Clock size={13} />
          <LocalTime value={s.starts_at} />
        </div>
        <div className="meta">
          {Math.round((+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000)}{" "}
          min · {s.difficulty} · {s.language}
        </div>
        <div className="meta">
          {lifecycle(s)} ·{" "}
          {s.registration_closed
            ? "Registration closed"
            : s.registration_mode === "approval"
              ? "Approval required"
              : "Registration available"}
        </div>
        <div className="card-bottom">
          <Link href={`/people/${s.host_id}`}>
            {s.profiles?.display_name || "Student host"}
          </Link>
          <Link className="text-link" href={`/sessions/${s.id}`}>
            View details{" "}
            <ArrowUpRight size={13} style={{ display: "inline" }} />
          </Link>
        </div>
      </div>
    </article>
  );
}
