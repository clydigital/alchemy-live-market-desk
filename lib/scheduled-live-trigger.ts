import {
  type ManualLiveTriggerAuthorization,
  verifyGitHubActionsScheduledLiveTrigger,
} from "./manual-live-trigger-auth.ts";
import { scheduledVideoSlotForDesk, type ScheduledVideoSlot } from "./scheduled-video-identity.ts";

type CanonicalResearchSlot = "morning" | "evening";
type ScheduledLiveTriggerStage = "video" | "acquisition" | "intelligence";
type ScheduledResearchHandler = (request: Request, slot: CanonicalResearchSlot) => Promise<Response>;
type ScheduledVideoHandler = (request: Request, forcedSlot?: ScheduledVideoSlot) => Promise<Response>;

type ScheduledLiveTriggerDependencies = {
  authorize?: (request: Request) => Promise<ManualLiveTriggerAuthorization>;
  cronSecret?: () => string | undefined;
  acquisition?: ScheduledResearchHandler;
  intelligence?: ScheduledResearchHandler;
  video?: ScheduledVideoHandler;
  logger?: (event: Record<string, unknown>) => void;
};

type ScheduledLiveTriggerInput = {
  slot?: unknown;
  stage?: unknown;
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

function validStage(value: unknown): value is ScheduledLiveTriggerStage {
  return value === "video" || value === "acquisition" || value === "intelligence";
}

async function readInput(request: Request): Promise<ScheduledLiveTriggerInput | null> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) return null;
  try {
    const input = await request.json();
    return input && typeof input === "object" ? input as ScheduledLiveTriggerInput : null;
  } catch {
    return null;
  }
}

/**
 * GitHub Actions is the precise production orchestrator while Vercel remains
 * on a Hobby plan. The bridge uses the exact canonical cron handlers and the
 * existing CRON_SECRET internally, so scheduled runs keep the normal run key
 * and never become manual retry identities.
 */
export async function handleScheduledLiveTriggerWithDependencies(
  request: Request,
  dependencies: ScheduledLiveTriggerDependencies = {},
) {
  const authorization = await (dependencies.authorize ?? verifyGitHubActionsScheduledLiveTrigger)(request);
  if (!authorization.authorized) {
    return json({ error: "Unauthorized scheduled Live trigger." }, 401);
  }

  const input = await readInput(request);
  if (!input || !validSlot(input.slot) || !validStage(input.stage)) {
    return json({ error: "slot and stage are required." }, 400);
  }

  const cronSecret = (dependencies.cronSecret ?? (() => process.env.CRON_SECRET))()?.trim();
  if (!cronSecret) {
    return json({ error: "The internal scheduled research credential is not configured." }, 503);
  }

  const logger = dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));
  logger({
    event: "scheduled_live_trigger_authorized",
    actor: authorization.actor,
    githubRunId: authorization.githubRunId,
    workflowSha: authorization.workflowSha,
    slot: input.slot,
    stage: input.stage,
    vercelRequestId: request.headers.get("x-vercel-id") || undefined,
  });

  const headers = {
    authorization: `Bearer ${cronSecret}`,
    "x-alchemy-scheduled-trigger": "github-actions-oidc",
    "x-github-actions-run-id": authorization.githubRunId,
  };

  if (input.stage === "video") {
    if (!dependencies.video) return json({ error: "The canonical video handler is unavailable." }, 503);
    const videoSlot = scheduledVideoSlotForDesk(input.slot);
    const internalRequest = new Request(
      `https://live-internal.invalid/api/cron/video/${videoSlot}`,
      { headers },
    );
    return dependencies.video(internalRequest, videoSlot);
  }

  const handler = input.stage === "acquisition"
    ? dependencies.acquisition
    : dependencies.intelligence;
  if (!handler) return json({ error: "The canonical scheduled handler is unavailable." }, 503);

  const internalRequest = new Request(
    `https://live-internal.invalid/api/cron/research/${input.slot}`,
    { headers },
  );
  return handler(internalRequest, input.slot);
}
