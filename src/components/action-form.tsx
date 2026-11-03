"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export async function command(
  action: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch("/api/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong");
  return result.data;
}
export function ActionForm({
  action,
  payload = {},
  children,
  label = "Save",
  redirect,
  className = "",
  confirm,
  reset = false,
}: {
  action: string;
  payload?: Record<string, unknown>;
  children?: React.ReactNode;
  label?: string;
  redirect?: string;
  className?: string;
  confirm?: string;
  reset?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState("");
  const router = useRouter();
  return (
    <form
      className={`action-form ${className}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const form = e.currentTarget;
        setPending(true);
        setMessage("");
        setUrl("");
        try {
          const values: Record<string, unknown> = {
            ...payload,
            ...Object.fromEntries(new FormData(form)),
          };
          form
            .querySelectorAll<HTMLInputElement>("input[type=checkbox]")
            .forEach((el) => (values[el.name] = el.checked));
          const data = await command(action, values);
          setFailed(false);
          if (action === "join" || action === "doubt_join") {
            setUrl(data);
            setMessage(
              "You are leaving PeerWave. The meeting provider’s terms apply.",
            );
          } else {
            setMessage("Saved successfully.");
            if (reset) form.reset();
            if (redirect) router.push(redirect.replace(":id", String(data)));
            router.refresh();
          }
        } catch (error) {
          setFailed(true);
          setMessage(error instanceof Error ? error.message : "Unable to save");
        } finally {
          setPending(false);
        }
      }}
    >
      {children}
      <Button type="submit" disabled={pending}>
        {pending ? "Working…" : label}
      </Button>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "form-error" : "form-success"}
        >
          {message}
        </p>
      )}
      {url && (
        <a
          className="button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open meeting ↗
        </a>
      )}
    </form>
  );
}
