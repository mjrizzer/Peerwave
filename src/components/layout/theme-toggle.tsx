"use client";
import { useEffect, useSyncExternalStore } from "react";
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
    <button
      type="button"
      className="lamp-toggle"
      data-lit={!dark}
      title={dark ? "Pull to turn the light on" : "Pull to turn the light off"}
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
      <svg
        className="hanging-lamp"
        viewBox="0 0 64 88"
        fill="none"
        aria-hidden="true"
      >
        <path className="lamp-wire" d="M26 0v25" />
        <path className="lamp-glow" d="M11 48 0 83h53L42 48Z" />
        <circle className="lamp-bulb" cx="26.5" cy="48" r="6" />
        <path className="lamp-shade" d="M17 25h19l10 23H7l10-23Z" />
        <path className="lamp-rim" d="M7 48h39" />
        <g className="lamp-pull">
          <path className="lamp-cord" d="M47 34v36" />
          <rect
            className="lamp-handle"
            x="44"
            y="69"
            width="6"
            height="10"
            rx="3"
          />
        </g>
      </svg>
      <span className="lamp-hint">Pull</span>
    </button>
  );
}
