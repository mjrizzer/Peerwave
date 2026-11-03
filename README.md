# PeerWave

Learn Together. Grow Together.

A Next.js student learning network with Firebase Authentication, Cloud Firestore transactions, protected external meeting access, requests, doubt rooms, circles, and moderation. Firebase replaces the originally requested Supabase stack at the owner's request after reaching Supabase limits. PostgreSQL migrations in `supabase/` are a retained alternative design, not the active database.

## Run locally

Requires Node.js 22+, npm, Java 21+, and Firebase CLI (`npm install -g firebase-tools`). On Windows use `npm.cmd` and `firebase.cmd` if PowerShell blocks scripts.

```sh
npm ci
cp .env.example .env.local
firebase emulators:start --only auth,firestore --project demo-peerwave
# In another terminal:
node --env-file=.env.local scripts/seed-firebase.mjs
npm run dev
```

Open http://localhost:3000. Emulator UI: http://localhost:4000. Signup verification and password reset links appear in the Auth emulator output. Local accounts and fixture data are not production accounts. Emulator data is temporary unless explicitly exported/imported using Firebase CLI. Do not point tests at production.

## Cloud configuration

The selected project is `peerwave-29830`. Its web app was registered, free-tier standard Firestore database created in `nam5`, and rules plus waitlist index deployed. No billing upgrade was enabled. Web configuration was saved only in the ignored `.local/firebase-web-config.json` on the original workstation.

1. In Firebase Console, enable Authentication > Email/Password. Enable Google optionally and set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
2. Add localhost and the deployed site domain to Authentication > Settings > Authorized domains. Configure email templates and password policy (minimum 10 characters).
3. Copy your web app configuration into the corresponding public environment variables. Public Firebase configuration identifies the app; authorization comes from server checks and security rules.
4. Remove `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST`; set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`.
5. Give the server Application Default Credentials, or set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` in private deployment environment variables. Use a dedicated service account restricted to this project and required Firestore/Auth operations. Do not paste credentials into Git, issues, or chat. CLI login alone does not configure Admin SDK credentials.
6. Run the seed script with those environment variables to add the 20 categories without overwriting existing data.
7. Deploy rules/indexes with `firebase deploy --only firestore --project peerwave-29830` after reviewing any existing project rules. Server rendering can deploy to Vercel using `npm run build`; Firebase Hosting static export cannot run these server routes.

The cloud application is not publicly deployed, and live cloud authentication has not been verified. Local emulator tests are the evidence for authenticated workflows.

## Checks

```sh
npm run typecheck
npm run lint
npm test
# With emulators running:
node scripts/run-firebase-tests.mjs
node scripts/run-firebase-tests.mjs e2e
# Public browser tests without configured Firebase:
npm run test:e2e -- tests/e2e/public.spec.ts
npm run build
```

Playwright needs Chromium (`npx playwright install chromium`). Its tests use port 3100; stop an old PeerWave development server before switching environment configuration. `npm test` skips Firebase tests when emulator settings are absent. PostgreSQL tests use PGlite with a simulated auth schema; they do not prove Firebase behavior. Firebase tests run actual Auth/Firestore emulators, including simultaneous registrations. See [implementation checklist](docs/checklist.md) for the exact verification scope.

## Optional Ollama

Install Ollama, pull a model such as `llama3.2`, set `AI_ENABLED=true`, and keep the server on loopback. The description assistant has an eight-second timeout and a deterministic template fallback. Core features do not depend on AI. Cloud deployments work with AI disabled; no remote paid inference or live audio transcription exists.

## Operations and limitations

See [architecture](docs/architecture.md), [database](docs/database.md), [security](docs/security.md), [deployment](docs/deployment.md), and [roadmap](docs/roadmap.md). This is a functional MVP under development, not a claim that all master-prompt requirements have shipped. Uploads, private invitations, advanced filters, scheduler delivery, and several social enhancements remain unfinished. In-app reminders require the scheduled-job implementation described in deployment documentation; no closed-browser push is provided.

Troubleshooting: `CONFIGURATION_NOT_FOUND` means configure Firebase Auth. Admin credential errors mean configure ADC/server secrets; never relax rules to fix them. Missing-index errors require deploying `firestore.indexes.json`. A full session correctly waitlists students; pending approvals do not expose joining details. Meeting links open only during the configured window for approved students.
