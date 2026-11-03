import Link from "next/link";
import { Waves, Menu } from "lucide-react";
import { currentUser } from "@/lib/backend/server";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
export async function Header() {
  const user = await currentUser();
  const links = (
    <>
      <Link href="/sessions">Explore sessions</Link>
      <Link href="/requests">Request a topic</Link>
      <Link href="/circles">Study circles</Link>
      <Link href="/doubts">Doubt rooms</Link>
    </>
  );
  return (
    <header className="shell nav">
      <Link className="brand" href="/" aria-label="PeerWave home">
        <span className="brand-icon">
          <Waves size={23} />
        </span>
        peerwave<span style={{ color: "var(--blue)" }}>.</span>
      </Link>
      <nav className="nav-links" aria-label="Main navigation">
        {links}
      </nav>
      <div className="nav-actions">
        <ThemeToggle />
        <Link href={user ? "/dashboard" : "/auth/login"} className="text-link">
          {user ? "My learning" : "Log in"}
        </Link>
        <Button asChild size="sm">
          <Link href={user ? "/host" : "/auth/signup"}>
            {user ? "Host a session" : "Join the community"} ↗
          </Link>
        </Button>
      </div>
      <details className="mobile-nav">
        <summary aria-label="Open navigation">
          <Menu />
        </summary>
        <nav>
          {links}
          <Link href={user ? "/dashboard" : "/auth/login"}>
            {user ? "My learning" : "Log in"}
          </Link>
          <Link href={user ? "/host" : "/auth/signup"}>
            {user ? "Host a session" : "Join the community"}
          </Link>
          <ThemeToggle />
        </nav>
      </details>
    </header>
  );
}
