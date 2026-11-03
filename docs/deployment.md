# Deployment

Deploy Next.js to a Node-compatible host such as Vercel. Configure Firebase web variables and private Admin credentials in host settings. Never enable emulator variables in production. Run lint, typecheck, tests, and build before deployment. Add the final domain to Firebase Auth authorized domains. Seed categories with an authorized operator credential. Grant moderator/admin roles only using a trusted operator/Admin SDK: `user_roles/{uid}_moderator` or `{uid}_admin`, containing user_id and role. Browser role edits are denied.

Project peerwave-29830 has a standard free-tier database in nam5. Rules and the waitlist index have been deployed. Authentication provider setup, server runtime credentials, category seeding, and web application hosting still need configuration. No paid feature or billing upgrade was enabled during implementation.

## Reminder job interface (unfinished)

The active Firebase backend does not yet deliver scheduled reminders. Implement an authenticated operator job that queries published sessions starting within 30 minutes, enumerates approved registrations, checks muted preferences, and transactionally creates one delivery record keyed by session, user, and start time plus a notification and user invalidation signal. Retries must be idempotent; schedule changes must permit a new delivery. Run every five minutes using an external scheduler. Never expose an unauthenticated reminder endpoint. The retained PostgreSQL implementation has a deliver_reminders function; it does not schedule or deliver Firebase reminders.

In-app notifications update while the page is open. No browser push infrastructure is configured. Do not promise delivery with the browser closed.
