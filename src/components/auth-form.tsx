"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updatePassword,
} from "firebase/auth";
import { browserFirebase } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup" | "reset" | "update_password" | "logout";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(payload: Record<string, string>) {
    setPending(true);
    setMessage("");
    try {
      const { auth } = browserFirebase();
      if (payload.action === "logout") {
        await signOut(auth);
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
        if (!response.ok)
          throw new Error("Could not end the server session. Try again.");
        router.push("/");
        router.refresh();
        return;
      }
      if (payload.action === "signup") {
        const { user } = await createUserWithEmailAndPassword(
          auth,
          payload.email,
          payload.password,
        );
        await sendEmailVerification(user, {
          url: `${window.location.origin}/auth/login`,
        });
        await signOut(auth);
        setMessage("Check your email to verify your account, then sign in.");
        return;
      }
      if (payload.action === "reset") {
        await sendPasswordResetEmail(auth, payload.email, {
          url: `${window.location.origin}/auth/login`,
        });
        setMessage("If an account exists, a reset email is on its way.");
        return;
      }
      if (payload.action === "update_password") {
        if (!auth.currentUser)
          throw new Error("Sign in again or request a password-reset email.");
        await updatePassword(auth.currentUser, payload.password);
        setMessage("Password updated.");
        return;
      }
      const result =
        payload.action === "google"
          ? await signInWithPopup(auth, new GoogleAuthProvider())
          : await signInWithEmailAndPassword(
              auth,
              payload.email,
              payload.password,
            );
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user, {
          url: `${window.location.origin}/auth/login`,
        });
        throw new Error(
          "Verify your email before signing in. A verification email has been sent.",
        );
      }
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "session",
          idToken: await result.user.getIdToken(true),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to authenticate");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit({
            action: mode,
            ...Object.fromEntries(new FormData(e.currentTarget)),
          } as Record<string, string>);
        }}
      >
        {mode !== "logout" && mode !== "update_password" && (
          <label className="field">
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@university.edu"
            />
          </label>
        )}
        {["login", "signup", "update_password"].includes(mode) && (
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              minLength={10}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              placeholder="At least 10 characters"
            />
          </label>
        )}
        <Button disabled={pending} type="submit">
          {pending
            ? "One moment…"
            : {
                login: "Welcome back",
                signup: "Create your account",
                reset: "Send reset link",
                update_password: "Update password",
                logout: "Log out",
              }[mode]}{" "}
          ↗
        </Button>
        {message && (
          <p role="status" className="form-error">
            {message}
          </p>
        )}
      </form>
      {(mode === "login" || mode === "signup") && (
        <>
          <hr className="divider" />
          {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => void submit({ action: "google" })}
            >
              Continue with Google
            </Button>
          )}
          <p className="subtle" style={{ marginTop: 15 }}>
            {mode === "login" ? (
              <>
                New here?{" "}
                <Link className="text-link" href="/auth/signup">
                  Join the community
                </Link>{" "}
                ·{" "}
                <Link className="text-link" href="/auth/reset">
                  Forgot password?
                </Link>
              </>
            ) : (
              <>
                Already a member?{" "}
                <Link className="text-link" href="/auth/login">
                  Log in
                </Link>
              </>
            )}
          </p>
        </>
      )}
    </>
  );
}
