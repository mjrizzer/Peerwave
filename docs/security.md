# Security

- Firebase verifies identities; server cookies are HttpOnly, SameSite=Lax, Secure in production, and expire after five days. Starting a session requires recently authenticated and email-verified tokens. Each request verifies revoked session state.
- Same-origin checks protect mutation endpoints. Client payloads cannot choose roles, user IDs, counters, or moderation privileges.
- All content access passes through server authorization. Admin SDK bypasses Firestore rules, so these server checks are essential and tested. Browser rules deny private data and all direct writes.
- Registration and selection operations are transactional. Rate limits persist in Firestore and cannot be raised by browser callers.
- Parsed meeting hostnames, direct path patterns, HTTPS, credentials, ports, and redirect parameters are checked. Links are never fetched by the app. No meeting URLs are stored in logs, notifications, or public metadata.
- React renders text without raw HTML. Uploaded files are not supported yet; no unsafe upload endpoint is provided.
- Secrets belong in ignored local environment files or deployment secret settings. No service-role key is needed in browser code. Emulator configuration is rejected in production by the Admin initializer.

Unlisted means anyone with the session-page URL can read metadata. It does not protect sensitive descriptions. Private invitations are unfinished. Revoking a PeerWave link cannot remove someone from an already-open external meeting. Attendance is not verified.

Production follow-up: stricter nonce-based CSP (current Next.js policy permits inline scripts), App Check/abuse protection before authentication, account export/deletion, operator privacy contact, retention, service-account IAM review, and independent security review. Development-tool minimatch advisories remain; runtime dependency audit is reported separately.
