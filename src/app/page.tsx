import Link from "next/link";
import { ArrowUpRight, BookOpen, Globe, Heart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/backend/server";
import { configured } from "@/lib/backend/config";
import { categories, type Session } from "@/lib/data";
import { SessionCard } from "@/components/sessions/card";
import { SetupNotice } from "@/components/setup-notice";
export default async function Home() {
  const ready = configured();
  const cats = await categories();
  let sessions: Session[] = [];
  let requests: { id: string; topic: string; description: string }[] = [];
  let hosts: { id: string; display_name: string; teach: string }[] = [];
  if (ready) {
    const client = await db();
    const results = await Promise.all([
      client
        .from("sessions")
        .select(
          "*,categories(name),profiles!sessions_host_id_fkey(display_name)",
        )
        .eq("visibility", "public")
        .eq("status", "published")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(3),
      client
        .from("session_requests")
        .select("id,topic,description")
        .is("session_id", null)
        .order("created_at", { ascending: false })
        .limit(3),
      client
        .from("profiles")
        .select("id,display_name,teach")
        .eq("onboarded", true)
        .neq("teach", "")
        .limit(3),
    ]);
    for (const r of results) if (r.error) throw new Error(r.error.message);
    sessions = results[0].data as unknown as Session[];
    requests = results[1].data as unknown as typeof requests;
    hosts = results[2].data as unknown as typeof hosts;
  }
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">
            A little curiosity. A world of possibility.
          </div>
          <h1>
            Your next learning moment starts with <em>someone like you.</em>
          </h1>
          <p>
            Big ideas don’t always start in a classroom. Discover free sessions,
            share what you know, and grow with students who get you.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/sessions">
                Explore sessions <ArrowUpRight size={17} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/host">
                Host a session <span>↗</span>
              </Link>
            </Button>
          </div>
          <div className="hero-note">
            <span className="avatar-stack" aria-hidden="true">
              <span>学</span>
              <span>π</span>
              <span>Aa</span>
              <span>λ</span>
            </span>
            <span>Student-powered. Curiosity-led. Always free.</span>
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration of a shared space for code, ideas, language and science"
        >
          <div className="art-stamp">
            GOOD IDEAS
            <br />
            GROW
            <br />
            TOGETHER ↗
          </div>
          <div className="art-caption">
            Different minds.
            <br />
            <em>Shared possibilities.</em>
            <small>Your place at the learning table</small>
          </div>
          <div className="learning-grid">
            <div className="learning-tile">
              {"{ }"}
              <small>Build something</small>
            </div>
            <div className="learning-tile">
              ✳<small>Find your spark</small>
            </div>
            <div className="learning-tile">
              Aa<small>Find your voice</small>
            </div>
            <div className="learning-tile">
              ∑<small>Connect the dots</small>
            </div>
          </div>
        </div>
      </section>
      <div className="ticker">
        <span>
          <BookOpen size={14} /> Free to learn
        </span>
        <span>
          <Users size={14} /> Open to every student
        </span>
        <span>
          <Globe size={14} /> Learn from anywhere
        </span>
        <span>
          <Heart size={14} /> Better together
        </span>
      </div>
      {!ready && <SetupNotice />}
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Make room for something new</div>
            <h2>
              Next up on your <em>learning journey.</em>
            </h2>
            <p>Small sessions. Real conversations. A new perspective.</p>
          </div>
          <Link className="text-link" href="/sessions">
            Explore all sessions ↗
          </Link>
        </div>
        {sessions.length ? (
          <div className="grid-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>Every community starts with a first session.</h3>
            <p>
              Have something to share? Make a little space for someone else to
              learn.
            </p>
            <Button asChild variant="outline">
              <Link href="/host">Host the first session ↗</Link>
            </Button>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>
              Follow your <em>curiosity.</em>
            </h2>
            <p>Find your thing. Or discover a completely new one.</p>
          </div>
        </div>
        <div className="chips">
          {cats.length
            ? cats.map((c) => (
                <Link
                  className="chip"
                  key={c.id}
                  href={`/sessions?category=${c.id}`}
                >
                  {c.name} ↗
                </Link>
              ))
            : [
                "Coding & DSA",
                "Creative conversations",
                "Artificial intelligence",
                "Career & confidence",
                "Language learning",
                "Study groups",
              ].map((c) => (
                <Link className="chip" key={c} href="/sessions">
                  {c} ↗
                </Link>
              ))}
        </div>
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Less friction. More connection.</div>
            <h2>
              A good place to <em>start.</em>
            </h2>
          </div>
        </div>
        <div className="grid-3 steps">
          <div className="step">
            <h3>Find your spark.</h3>
            <p>
              Explore a topic you love, or request the session you wish existed.
            </p>
          </div>
          <div className="step">
            <h3>Pull up a chair.</h3>
            <p>
              Register for a free session, ask questions, and meet people
              learning alongside you.
            </p>
          </div>
          <div className="step">
            <h3>Pass it forward.</h3>
            <p>
              Share one thing you know. You don’t need to be an expert to make a
              difference.
            </p>
          </div>
        </div>
      </section>
      <section className="request-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">You ask. We learn.</div>
            <h2>
              If you’re curious,
              <br />
              <em>someone else is too.</em>
            </h2>
            <p>Student-requested sessions, shaped by what you want to learn.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/requests">The request board ↗</Link>
          </Button>
        </div>
        {requests.length ? (
          requests.map((r) => (
            <Link key={r.id} href={`/requests/${r.id}`} className="request-row">
              <div>
                <h3>{r.topic}</h3>
                <p>{r.description.slice(0, 120)}</p>
              </div>
              <ArrowUpRight size={22} />
            </Link>
          ))
        ) : (
          <div className="request-row">
            <div>
              <h3>What would you love to learn next?</h3>
              <p>Post a topic. Gather interest. Find a peer who can help.</p>
            </div>
            <Link href="/requests/new" className="text-link">
              Request a session ↗
            </Link>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <h2>
              Good people. <em>Generous minds.</em>
            </h2>
            <p>Meet learners with something to share.</p>
          </div>
          <Link href="/people" className="text-link">
            Meet your peers ↗
          </Link>
        </div>
        {hosts.length ? (
          <div className="grid-3">
            {hosts.map((h) => (
              <Link
                className="panel person"
                key={h.id}
                href={`/people/${h.id}`}
              >
                <span className="avatar">{h.display_name[0]}</span>
                <div>
                  <h3>{h.display_name}</h3>
                  <small className="muted">{h.teach}</small>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted">
            The community is just getting started. Your knowledge could be
            someone’s next breakthrough.
          </p>
        )}
      </section>
      <section className="manifesto">
        <div>
          <div className="eyebrow">More than a one-time session</div>
          <h2>
            Find your people.
            <br />
            <em>Keep growing.</em>
          </h2>
          <p className="muted">
            Make a habit of learning with study circles, shared discussions, and
            a little encouragement along the way.
          </p>
          <Link href="/circles" className="text-link">
            Discover study circles ↗
          </Link>
        </div>
        <div className="panel">
          <span className="badge">Our community promise</span>
          <blockquote style={{ marginTop: 20 }}>
            Anyone can learn. Anyone can teach. Everyone can grow together.
          </blockquote>
          <p className="subtle" style={{ marginTop: 20 }}>
            A PeerWave principle — not a student testimonial. We’ll share real
            community stories here when we have them.
          </p>
          <Link href="/guidelines" className="text-link">
            Kindness is part of the curriculum ↗
          </Link>
        </div>
      </section>
    </>
  );
}
