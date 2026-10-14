import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CONTRACT_VERSION,
  PresenterCheckItem,
  createDefaultPresenterChecklist,
  normalizePresenterChecklistTimestamps,
  validateIncomingPutPayload,
} from "@/lib/presenter-technical-checks";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
};

async function authenticateAndAuthorize() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: "Presenter checklist storage is temporarily unavailable." },
        { status: 503, headers: RESPONSE_HEADERS },
      ),
    };
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    return {
      errorResponse: NextResponse.json(
        { error: "Authentication required." },
        { status: 401, headers: RESPONSE_HEADERS },
      ),
    };
  }

  const email = user.email.trim().toLowerCase();
  const { data: access, error: accessError } = await supabase
    .from("app_access_allowlist")
    .select("email")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (accessError || !access) {
    return {
      errorResponse: NextResponse.json(
        { error: "This account is not approved for the dashboard." },
        { status: 403, headers: RESPONSE_HEADERS },
      ),
    };
  }

  return { supabase, user };
}

export async function GET() {
  const auth = await authenticateAndAuthorize();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { supabase, user } = auth;

  try {
    const { data, error } = await supabase
      .from("presenter_technical_checklists")
      .select("contract_version, checks, history, revision, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Presenter checklist storage is temporarily unavailable." },
        { status: 503, headers: RESPONSE_HEADERS },
      );
    }

    if (!data) {
      return NextResponse.json(createDefaultPresenterChecklist(), {
        status: 200,
        headers: RESPONSE_HEADERS,
      });
    }

    return NextResponse.json(
      {
        contractVersion: data.contract_version,
        checks: data.checks,
        history: data.history,
        revision: Number(data.revision),
        updatedAt: data.updated_at,
      },
      { status: 200, headers: RESPONSE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "Presenter checklist storage is temporarily unavailable." },
      { status: 503, headers: RESPONSE_HEADERS },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await authenticateAndAuthorize();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { supabase, user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const validation = validateIncomingPutPayload(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400, headers: RESPONSE_HEADERS },
    );
  }

  const { expectedRevision, checks: rawChecks, history: rawHistory } = validation;

  try {
    const { data: existing, error: readError } = await supabase
      .from("presenter_technical_checklists")
      .select("checks, revision")
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json(
        { error: "Presenter checklist storage is temporarily unavailable." },
        { status: 503, headers: RESPONSE_HEADERS },
      );
    }

    const now = new Date().toISOString();
    const existingChecks = Array.isArray(existing?.checks) ? (existing.checks as PresenterCheckItem[]) : null;
    const { checks, history } = normalizePresenterChecklistTimestamps(
      rawChecks,
      existingChecks,
      rawHistory,
      now,
    );

    if (existing !== null) {
      const currentRevision = Number(existing.revision);
      if (expectedRevision !== currentRevision) {
        return NextResponse.json(
          {
            error: "Revision mismatch. The checklist has been updated elsewhere.",
            currentRevision,
          },
          { status: 409, headers: RESPONSE_HEADERS },
        );
      }

      const nextRevision = currentRevision + 1;
      const { data: updated, error: updateError } = await supabase
        .from("presenter_technical_checklists")
        .update({
          contract_version: CONTRACT_VERSION,
          checks,
          history,
          revision: nextRevision,
          updated_at: now,
        })
        .eq("user_id", user.id)
        .eq("revision", expectedRevision)
        .select("contract_version, checks, history, revision, updated_at")
        .maybeSingle();

      if (updateError) {
        return NextResponse.json(
          { error: "Presenter checklist storage is temporarily unavailable." },
          { status: 503, headers: RESPONSE_HEADERS },
        );
      }

      if (!updated) {
        const { data: reRead } = await supabase
          .from("presenter_technical_checklists")
          .select("revision")
          .eq("user_id", user.id)
          .maybeSingle();

        return NextResponse.json(
          {
            error: "Revision mismatch. The checklist has been updated elsewhere.",
            currentRevision: reRead ? Number(reRead.revision) : currentRevision,
          },
          { status: 409, headers: RESPONSE_HEADERS },
        );
      }

      return NextResponse.json(
        {
          contractVersion: updated.contract_version,
          checks: updated.checks,
          history: updated.history,
          revision: Number(updated.revision),
          updatedAt: updated.updated_at,
        },
        { status: 200, headers: RESPONSE_HEADERS },
      );
    } else {
      if (expectedRevision !== 0) {
        return NextResponse.json(
          {
            error: "Revision mismatch. Checklist does not exist yet.",
            currentRevision: 0,
          },
          { status: 409, headers: RESPONSE_HEADERS },
        );
      }

      const { data: inserted, error: insertError } = await supabase
        .from("presenter_technical_checklists")
        .insert({
          user_id: user.id,
          contract_version: CONTRACT_VERSION,
          checks,
          history,
          revision: 1,
          updated_at: now,
        })
        .select("contract_version, checks, history, revision, updated_at")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return NextResponse.json(
            { error: "Checklist already exists for this account." },
            { status: 409, headers: RESPONSE_HEADERS },
          );
        }
        return NextResponse.json(
          { error: "Presenter checklist storage is temporarily unavailable." },
          { status: 503, headers: RESPONSE_HEADERS },
        );
      }

      return NextResponse.json(
        {
          contractVersion: inserted.contract_version,
          checks: inserted.checks,
          history: inserted.history,
          revision: Number(inserted.revision),
          updatedAt: inserted.updated_at,
        },
        { status: 200, headers: RESPONSE_HEADERS },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Presenter checklist storage is temporarily unavailable." },
      { status: 503, headers: RESPONSE_HEADERS },
    );
  }
}
