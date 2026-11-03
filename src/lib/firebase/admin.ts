import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
export function adminApp() {
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST)
  )
    throw new Error("Emulators must not be enabled in production");
  return (
    getApps()[0] ||
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-peerwave",
      ...(process.env.FIRESTORE_EMULATOR_HOST
        ? {}
        : {
            credential: process.env.FIREBASE_PRIVATE_KEY
              ? cert({
                  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
                    /\\n/g,
                    "\n",
                  ),
                })
              : applicationDefault(),
          }),
    })
  );
}
export function firestore() {
  return getFirestore(adminApp());
}
export function adminAuth() {
  return getAuth(adminApp());
}
