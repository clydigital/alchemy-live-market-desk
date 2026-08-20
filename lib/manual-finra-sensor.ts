import {
  verifyGitHubActionsManualLiveTrigger,
  type ManualLiveTriggerAuthorization,
} from "./manual-live-trigger-auth";
import {
  type FinraSensorMemoryCaptureResult,
} from "./providers/finra-sensor-memory";
import { formatFinraTradeDate } from "./providers/finra-short-volume";

type ManualFinraSensorInput = {
  tradeDate?: unknown;
  symbols?: unknown;
};

type ManualFinraSensorDependencies = {
  authorize?: (request: Request) => Promise<ManualLiveTriggerAuthorization>;
  capture?: (
    tradeDate: string,
    symbols: string[],
  ) => Promise<FinraSensorMemoryCaptureResult>;
  logger?: (event: Record<string, unknown>) => void;
};

function json(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readInput(request: Request): Promise<ManualFinraSensorInput | null> {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 4_096) return null;
  try {
    const value = await request.json();
    return value && typeof value === "object" ? value as ManualFinraSensorInput : null;
  } catch {
    return null;
  }
}

function normaliseRequestedSymbols(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const symbols = [...new Set(value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const symbol = item.trim().toUpperCase();
    if (!/^[A-Z0-9._-]{1,20}$/.test(symbol)) return [];
    return [symbol];
  }))];
  if (!symbols.length || symbols.length !== value.length) return null;
  return symbols.sort();
}

async function captureProductionFinraSensor(tradeDate: string, symbols: string[]) {
  const { captureFinraSensorMemoryToSupabase } = await import("./providers/finra-sensor-memory-supabase");
  return captureFinraSensorMemoryToSupabase(tradeDate, symbols);
}

export async function handleManualFinraSensorRunWithDependencies(
  request: Request,
  dependencies: ManualFinraSensorDependencies = {},
) {
  const authorization = await (dependencies.authorize ?? verifyGitHubActionsManualLiveTrigger)(request);
  if (!authorization.authorized) {
    return json({ error: "Unauthorized FINRA sensor-memory trigger." }, 401);
  }

  const input = await readInput(request);
  if (!input || typeof input.tradeDate !== "string") {
    return json({ error: "tradeDate and symbols are required." }, 400);
  }

  let tradeDate: string;
  try {
    tradeDate = formatFinraTradeDate(input.tradeDate);
  } catch {
    return json({ error: "tradeDate must be a valid YYYY-MM-DD date." }, 400);
  }
  const symbols = normaliseRequestedSymbols(input.symbols);
  if (!symbols) {
    return json({ error: "symbols must contain 1-20 unique valid FINRA symbols." }, 400);
  }

  const logger = dependencies.logger ?? ((event) => console.info(JSON.stringify(event)));
  logger({
    event: "manual_finra_sensor_memory_authorized",
    actor: authorization.actor,
    githubRunId: authorization.githubRunId,
    workflowSha: authorization.workflowSha,
    tradeDate,
    symbols,
    vercelRequestId: request.headers.get("x-vercel-id") || undefined,
  });

  try {
    const capture = dependencies.capture ?? captureProductionFinraSensor;
    const result = await capture(tradeDate, symbols);
    if (result.state !== "ready" || !result.memory) {
      return json({
        status: "unavailable",
        tradeDate,
        symbols,
        rowsFetched: result.rowsFetched,
        sourceUrl: result.sourceUrl,
        note: result.note,
      }, 503);
    }
    return json({
      status: "ready",
      tradeDate,
      symbols,
      rowsFetched: result.rowsFetched,
      sourceUrl: result.sourceUrl,
      memory: result.memory,
    }, 200);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : "FINRA sensor-memory capture failed.",
    }, 500);
  }
}
