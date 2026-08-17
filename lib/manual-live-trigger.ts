import {
  type ManualLiveTriggerAuthorization,
  verifyGitHubActionsManualLiveTrigger,
} from "./manual-live-trigger-auth.ts";

type CanonicalResearchSlot = "morning" | "evening";
type ManualLiveTriggerStage = "acquisition" | "intelligence";
type ScheduledHandler = (request: Request, slot: CanonicalResearchSlot) => Promise<Response>;

type ManualLiveTriggerDependencies = {
  authorize?: (request: Request) => Promise<ManualLiveTriggerAuthorization>;
  cronSecret?: () => string | undefined;
  acquisition?: ScheduledHandler;
  intelligence?: ScheduledHandler;
  logger?: (event: Record<string, unknown>) => void;
};

type ManualLiveTriggerInput = {
  slot?: unknown;
  stage?: unknown;
  retryKey?: unknown;
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function validSlot(value: unknown): value is CanonicalResearchSlot {
  return value === "morning" || value === "evening";
}

function validStage(value: unknown): value is ManualLiveTriggerStage {
  return value === "acquisition" || value === "intelligence";
}

function validRetryKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,40}$/i.test(value);
}

async function readInput(request: Request): Promise<ManualLiveTriggerInput | null> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) return null;
  try {
    const input = await request.json();
    return input && typeof input === "object" ? input as ManualLiveTriggerInput : null;
  } catch {
    return null;
  }
}

export async function handleManualLiveTriggerWithDependencies(
  request: Request,
  dependencies: ManualLiveTriggerDependencies = {},
) {
  const authorization = await (dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger)(request);
  if (!authorization.authorized) {
    return json({ error: "Unauthorized manual Live trigger." }, 401);
  }

  const input = await readInput(request);
  if (!input || !validSlot(input.slot) || !validStage(input.stage) || !validRetryKey(input.retryKey)) {
    return json({
      error: "slot, stage, and an audited retryKey are required.",
    }, 400);
  }

  const cronSecret = (dependencies.cronSecret ?? (() => process.env.CRON_SECRET))()?.trim();
  if (!cronSecret) {
    return json({ error: "The internal scheduled research credential is not configured." }, 503);
  }

  const logger = dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));
  logger({
    event: "manual_live_trigger_authorized",
    actor: authorization.actor,
    githubRunId: authorization.githubRunId,
    workflowSha: authorization.workflowSha,
    slot: input.slot,
    stage: input.stage,
    retryKey: input.retryKey,
    vercelRequestId: request.headers.get("x-vercel-id") || undefined,
  });

  const internalRequest = new Request(
    `https://live-internal.invalid/api/cron/research/${input.slot}?retry=${encodeURIComponent(input.retryKey)}`,
    {
      headers: {
        authorization: `Bearer ${cronSecret}`,
        "x-alchemy-manual-trigger": "github-actions-oidc",
        "x-github-actions-run-id": authorization.githubRunId,
      },
    },
  );
  const handler = input.stage === "acquisition"
    ? dependencies.acquisition
    : dependencies.intelligence;
  if (!handler) {
    return json({ error: "The canonical scheduled handler is unavailable." }, 503);
  }

  return handler(internalRequest, input.slot);
}
