"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function LocalTime({ value }: { value: string }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const label = mounted
    ? new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(value))
    : new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  return <time dateTime={value}>{label}</time>;
}
