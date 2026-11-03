import { spawnSync } from "node:child_process";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-peerwave";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "demo-key";
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = "demo-peerwave.firebaseapp.com";
process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "demo-app";
process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS = "true";
const target =
  process.argv[2] === "e2e"
    ? "node_modules/@playwright/test/cli.js"
    : "node_modules/vitest/vitest.mjs";
const args =
  process.argv[2] === "e2e"
    ? ["test", "tests/e2e/authenticated.spec.ts"]
    : ["run", "tests/firebase"];
const result = spawnSync(process.execPath, [target, ...args, ...process.argv.slice(3)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
