"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
function subscribe(cb: () => void) {
  window.addEventListener("peerwave-theme", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("peerwave-theme", cb);
    window.removeEventListener("storage", cb);
  };
}
function snapshot() {
  try {
    return (
      localStorage.getItem("peerwave-theme") === "dark" ||
      (!localStorage.getItem("peerwave-theme") &&
        matchMedia("(prefers-color-scheme: dark)").matches)
    );
  } catch {
    return false;
  }
}
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, snapshot, () => false);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  return (
    <Button
      variant="ghost"
      onClick={() => {
        try {
          localStorage.setItem("peerwave-theme", dark ? "light" : "dark");
          window.dispatchEvent(new Event("peerwave-theme"));
        } catch {
          document.documentElement.dataset.theme = dark ? "light" : "dark";
        }
      }}
      aria-label={dark ? "Use light mode" : "Use dark mode"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </Button>
  );
}
