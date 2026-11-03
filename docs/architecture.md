# Architecture

Next.js App Router renders public and authenticated pages. Components call same-origin Route Handlers. Zod validates input; Firebase Admin verifies HttpOnly session cookies, including revocation. Domain commands run through `src/lib/firebase/commands.ts`. Firestore transactions retry contention and commit buffered writes only after all reads.

`Store` handles persistence; the query facade applies server authorization to every fetched row and every expanded relation. The facade preserves the UI's repository interface after the authorized Supabase-to-Firebase migration. It deliberately supports only implemented query methods. Queries are bounded to 1,000 candidates, with UI pagination for sessions. This is an MVP limit, not a scalable full-text search system; replace candidate scans with indexed queries/cursors as usage grows.

Private link documents are never returned by the query facade. Dedicated commands verify identity, membership, host ownership, scheduled join window, cancellation, blocking, and revocation. Hosts can retrieve their own links to edit drafts.

Firestore browser rules deny all content reads/writes. The only directly readable records are scoped timestamp invalidations in `changes`. Browser listeners refresh server-rendered content; 30-second polling is the fallback. Subscriptions and timers are cleaned up. No shared in-memory user state is used for durable functionality.

The PostgreSQL/Supabase migrations remain as an alternative historical implementation. They are not used by Firebase, and passing their tests is not Firebase verification.
