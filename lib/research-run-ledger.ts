export type ResearchRunLedgerStartFields = {
  schedule_slot: string;
  scheduled_for: string;
  status: "running";
  accuracy_gate: string;
  required_sources_complete: boolean;
  evidence_gate_passed: boolean;
  source_checks: unknown[];
  videos_found: number;
  transcripts_ready: number;
  news_scanned: number;
  candidates_kept: number;
  articles_scanned: number;
  articles_flagged: number;
  evidence_added: number;
  updates_published: number;
  warnings: string[];
  summary: string | null;
  updated_at: string;
};

export async function writeResearchRunLedgerStart(input: {
  rest: <T>(path: string, init?: RequestInit) => Promise<T>;
  runKey: string;
  isScheduledInternalRequest: boolean;
  fields: ResearchRunLedgerStartFields;
  now?: string;
}) {
  const { rest, runKey, isScheduledInternalRequest, fields } = input;
  const now = input.now ?? new Date().toISOString();

  if (isScheduledInternalRequest) {
    const existingRows = await rest<Array<{ id: string }>>(
      `research_runs?run_key=eq.${encodeURIComponent(runKey)}&select=id`,
      {},
    );
    if (!existingRows.length) {
      throw new Error(
        `Scheduled research run not found by run_key ${runKey}. `
        + "Cron handler must claim the run before publisher invocation. "
        + "This indicates a claim/publication race or missing claim step.",
      );
    }

    const runId = existingRows[0].id;
    await rest(`research_runs?id=eq.${encodeURIComponent(runId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(fields),
    });
    return runId;
  }

  const runRows = await rest<Array<{ id: string }>>("research_runs?on_conflict=run_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      run_key: runKey,
      started_at: now,
      ...fields,
    }),
  });
  const runId = runRows[0]?.id || null;
  if (!runId) throw new Error("The research run did not return an id.");
  return runId;
}
