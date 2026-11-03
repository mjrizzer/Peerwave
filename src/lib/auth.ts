import { redirect } from "next/navigation";
import { currentUser, db } from "./backend/server";
export async function requireUser(onboarded = true) {
  const user = await currentUser();
  if (!user) redirect("/auth/login");
  const client = await db();
  const { data: profile, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (error) throw new Error(error.message);
  if (onboarded && !profile.onboarded) redirect("/onboarding");
  return { user, profile, client };
}
