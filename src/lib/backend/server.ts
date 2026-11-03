import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { configured } from "./config";
import { adminAuth } from "@/lib/firebase/admin";
import { Query } from "@/lib/firebase/query";
import { executeRpc } from "@/lib/firebase/commands";
import type { Actor, Row } from "@/lib/firebase/store";
export const currentUser = cache(async (): Promise<Actor> => {
  if (!configured()) return null;
  const value = (await cookies()).get("__session")?.value;
  if (!value) return null;
  try {
    const user = await adminAuth().verifySessionCookie(value, true);
    return {
      id: user.uid,
      email: user.email,
      email_verified: !!user.email_verified,
    };
  } catch {
    return null;
  }
});
export async function db() {
  if (!configured())
    throw new Error(
      "Connect Firebase to use accounts and community features. See README.md.",
    );
  const actor = await currentUser();
  return {
    from: (table: string) => new Query(table, actor),
    auth: { getUser: async () => ({ data: { user: actor } }) },
    rpc: async (name: string, args: Row = {}) => {
      try {
        return { data: await executeRpc(actor, name, args), error: null };
      } catch (e) {
        return {
          data: null,
          error: {
            message:
              e instanceof Error ? e.message : "Unable to complete request",
            code: "APPLICATION_ERROR",
          },
        };
      }
    },
  };
}
