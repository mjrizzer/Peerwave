import { notFound } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/backend/config";
import { SetupNotice } from "@/components/setup-notice";
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { mode } = await params;
  const { error } = await searchParams;
  if (!["login", "signup", "reset", "update-password"].includes(mode))
    notFound();
  return (
    <div className="auth-layout">
      <div>
        <div className="eyebrow">Your next chapter starts here</div>
        <h1>
          A place for your
          <br />
          <em>curious mind.</em>
        </h1>
        <p className="muted">
          Ask the question. Share the idea. Meet the people who make learning
          feel a little more human.
        </p>
      </div>
      <div className="auth-panel">
        <h2>
          {mode === "login"
            ? "Welcome back."
            : mode === "signup"
              ? "Come as you are."
              : mode === "reset"
                ? "Let’s get you back in."
                : "A fresh start."}
        </h2>
        <p className="muted">
          {mode === "signup"
            ? "Everyone has something to learn. Everyone has something to teach."
            : "Learn Together. Grow Together."}
        </p>
        {!configured() ? (
          <SetupNotice />
        ) : (
          <AuthForm
            mode={
              mode.replace("-", "_") as
                "login" | "signup" | "reset" | "update_password"
            }
          />
        )}{" "}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
