"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { browserFirebase } from "@/lib/firebase/client";
export function Realtime({
  table,
  filter,
}: {
  table: string;
  filter?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("Connecting to updates…");
  useEffect(() => {
    const { db } = browserFirebase();
    const value = filter?.split("=eq.")[1];
    const path =
      table === "notifications"
        ? `user_${value}`
        : table === "circle_posts"
          ? `circle_${value}`
          : table === "instant_doubt_requests"
            ? "doubts"
            : `session_${value}`;
    let timer: ReturnType<typeof setTimeout>;
    let first = true;
    const unsubscribe = onSnapshot(
      doc(db, "changes", path),
      () => {
        setStatus("Updates connected");
        if (!first) {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 250);
        }
        first = false;
      },
      () => setStatus("Checking for updates every 30 seconds"),
    );
    const poll = setInterval(() => router.refresh(), 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      unsubscribe();
    };
  }, [table, filter, router]);
  return <small className="muted">{status}</small>;
}
