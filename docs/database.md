# Database

Firestore collections mirror the domain entities in the original relational design: profiles, profile_academics, categories, sessions, session_links, registrations, messages, questions, votes, requests, interests, proposals, doubts, volunteers, doubt_links, circles, memberships, posts, follows, topic_follows, reviews, saved_sessions, notifications, preferences, reports, roles, blocks, moderation_actions, audit_logs, rate_limits, usernames, and changes.

Sessions use UUIDs; Firebase Auth user IDs remain opaque strings. Composite document IDs enforce unique registrations, votes, interests, follows, memberships, and reviews. Username reservation and profile edits happen in one transaction. Private academic details are stored separately.

Every registration transaction reads and updates the session's authoritative approved_count. Duplicate registration returns its existing status. Host approvals enforce capacity. Cancellation changes registration and count and promotes the oldest available waitlist entries transactionally. A composite index orders the waitlist by session_id, status, and created_at.

Proposal acceptance updates the request's accepted_proposal_id transactionally. Helper acceptance updates one doubt request transactionally. Competing requests retry and then fail safely once selection is complete.

Firestore has no SQL foreign keys. Domain commands validate referenced records and ownership. There is currently no self-service account deletion or general cascade-deletion system; operators must preserve referential consistency during maintenance. Database import/migration automation and long-term retention remain production work.
