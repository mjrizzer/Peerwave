import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/admin";
import { transaction, now } from "@/lib/firebase/store";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Request origin not allowed" },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 12000) throw new Error("Request too large");
    const p = z
      .object({
        action: z.enum(["session", "logout"]),
        idToken: z.string().max(10000).optional(),
      })
      .parse(JSON.parse(raw));
    const jar = await cookies();
    if (p.action === "logout") {
      jar.delete("__session");
      return NextResponse.json({ redirect: "/" });
    }
    if (!p.idToken) throw new Error("Sign in first");
    const token = await adminAuth().verifyIdToken(p.idToken, true);
    if (!token.email_verified)
      throw new Error("Verify your email before signing in. Check your inbox.");
    const old = jar.get("__session")?.value;
    let returning = false;
    if (old) {
      try {
        returning =
          (await adminAuth().verifySessionCookie(old, true)).uid === token.uid;
      } catch {}
    }
    if (!returning && Date.now() / 1000 - token.auth_time > 300)
      throw new Error("Please sign in again to start a fresh session");
    await transaction(async (s) => {
      const existing = await s.get("profiles", token.uid);
      if (existing?.suspended)
        throw new Error(
          "Your account is suspended. Contact the platform operator.",
        );
      if (!existing)
        s.set("profiles", token.uid, {
          display_name: token.name?.slice(0, 70) || "New learner",
          username: null,
          bio: "",
          interests: "",
          skills: "",
          learn: "",
          teach: "",
          language: "English",
          time_zone: "UTC",
          onboarded: false,
          suspended: false,
          created_at: now(),
        });
    });
    const maxAge = 5 * 24 * 60 * 60;
    const value = await adminAuth().createSessionCookie(p.idToken, {
      expiresIn: maxAge * 1000,
    });
    jar.set("__session", value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });
    return NextResponse.json(
      { redirect: "/dashboard" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Authentication failed" },
      { status: 400 },
    );
  }
}
