import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: Request) {
  let payload: { code?: string; verifier?: string; redirectUri?: string };
  try {
    payload = await request.json();
  } catch {
    return response({ error: "Invalid SSO exchange payload." }, 400);
  }

  const code = payload.code || "";
  const verifier = payload.verifier || "";
  const redirectUri = payload.redirectUri || "";
  if (code.length < 30 || verifier.length < 40 || redirectUri.length < 20) {
    return response({ error: "Incomplete SSO exchange payload." }, 400);
  }

  try {
    const admin = createSupabaseAdminClient();
    const codeHash = sha256(code);
    const { data: ticket, error: ticketError } = await admin
      .from("app_sso_tickets")
      .select("code_hash,verifier_challenge,redirect_uri,token_hash,email,expires_at,consumed_at")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (ticketError || !ticket) return response({ error: "SSO ticket not found." }, 404);
    if (ticket.consumed_at) return response({ error: "SSO ticket has already been used." }, 409);
    if (Date.parse(ticket.expires_at) <= Date.now()) return response({ error: "SSO ticket has expired." }, 410);
    if (ticket.redirect_uri !== redirectUri) return response({ error: "SSO redirect mismatch." }, 403);
    if (!safeEqual(ticket.verifier_challenge, sha256(verifier))) {
      return response({ error: "SSO verifier mismatch." }, 403);
    }

    const consumedAt = new Date().toISOString();
    const { data: consumed, error: consumeError } = await admin
      .from("app_sso_tickets")
      .update({ consumed_at: consumedAt })
      .eq("code_hash", codeHash)
      .is("consumed_at", null)
      .select("code_hash")
      .maybeSingle();
    if (consumeError || !consumed) return response({ error: "SSO ticket was consumed elsewhere." }, 409);

    void admin
      .from("app_sso_tickets")
      .delete()
      .lt("expires_at", new Date(Date.now() - 300_000).toISOString());

    return response({ tokenHash: ticket.token_hash, email: ticket.email });
  } catch (error) {
    return response(
      { error: error instanceof Error ? error.message : "SSO exchange failed." },
      500,
    );
  }
}
