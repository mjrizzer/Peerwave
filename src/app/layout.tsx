import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Header } from "@/components/layout/header";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "PeerWave — Learn Together. Grow Together.",
    template: "%s · PeerWave",
  },
  description:
    "A student-powered learning community. Discover free sessions, share what you know, and find your people.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main" className="shell">
          {children}
        </main>
        <footer className="shell footer">
          <div>
            <Link className="brand" href="/">
              peerwave.
            </Link>
            <p>Learn Together. Grow Together.</p>
            <span>
              © {new Date().getFullYear()} PeerWave. Built for shared curiosity.
            </span>
          </div>
          <nav className="footer-links">
            <Link href="/guidelines">Community guidelines</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/people">Meet your peers</Link>
            <Link href="/host">Become a host</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
