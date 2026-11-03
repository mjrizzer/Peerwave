import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/backend/server";
import { commands } from "@/lib/validations/commands";
import { id, profileSchema, sessionSchema } from "@/lib/validations";
import { descriptionAssistant } from "@/lib/ai/assistant";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json(
      { error: "Request origin not allowed" },
      { status: 403 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 20000)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const { action, payload } = z
      .object({
        action: z.string(),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(raw));
    const client = await db();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: "Sign in to continue" },
        { status: 401 },
      );
    let result;
    if (action === "profile")
      result = await client.rpc("save_profile", {
        p: profileSchema.parse(payload),
      });
    else if (action === "session")
      result = await client.rpc("save_session", {
        p: sessionSchema.parse(payload),
      });
    else if (action === "register")
      result = await client.rpc("register_session", {
        sid: id.parse(payload.id),
      });
    else if (action === "registration") {
      const p = z
        .object({
          id,
          user_id: id,
          status: z.enum(["approved", "rejected", "removed", "cancelled"]),
        })
        .parse(payload);
      result = await client.rpc("change_registration", {
        sid: p.id,
        target: p.user_id,
        decision: p.status,
      });
    } else if (action === "session_control") {
      const p = z
        .object({
          id,
          control: z.enum(["cancel", "close", "reopen", "revoke"]),
        })
        .parse(payload);
      result = await client.rpc("session_control", {
        sid: p.id,
        action: p.control,
      });
    } else if (action === "join" || action === "doubt_join")
      result = await client.rpc(
        action === "join" ? "join_details" : "doubt_join_details",
        action === "join"
          ? { sid: id.parse(payload.id) }
          : { did: id.parse(payload.id) },
      );
    else if (action === "moderate") {
      const p = z
        .object({
          id,
          decision: z.enum(["remove", "suspend", "dismiss"]),
          reason: z.string().min(5).max(2000),
        })
        .parse(payload);
      result = await client.rpc("moderate", {
        rid: p.id,
        decision: p.decision,
        reason: p.reason,
      });
    } else if (action === "category") {
      const p = z
        .object({
          id: id.optional(),
          name: z.string().min(2).max(80),
          slug: z.string().regex(/^[a-z0-9-]{2,80}$/),
          active: z.boolean(),
        })
        .parse(payload);
      result = await client.rpc("manage_category", {
        cid: p.id ?? null,
        label: p.name,
        slug_value: p.slug,
        enabled: p.active,
      });
    } else if (action === "assist") {
      const p = z
        .object({
          title: z.string().min(8).max(140),
          description: z.string().max(4000),
        })
        .parse(payload);
      const { error } = await client.rpc("ai_allow");
      if (error) throw new Error(error.message);
      return NextResponse.json({
        data: await descriptionAssistant(p.title, p.description),
      });
    } else if (commands[action])
      result = await client.rpc("community_action", {
        kind: action,
        p: commands[action].parse(payload),
      });
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    if (result.error)
      return NextResponse.json(
        {
          error:
            result.error.code === "23505"
              ? "This already exists. Refresh to see the current state."
              : result.error.message,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    return NextResponse.json(
      { data: result.data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : error instanceof Error
              ? error.message
              : "Unable to complete your request",
      },
      { status: 400 },
    );
  }
}
