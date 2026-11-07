/**
 * Source-only completion contract for the EXISTING authorised Vercel research
 * acquisition slots. The rollback switch restores the old dedicated intelligence
 * continuation without changing schedules or historical research editions.
 *
 * Do not use this contract for user-directed manual research, and never treat
 * a completed source sweep as proof of verified market reaction or a Story.
 */
export const SOURCE_ONLY_RESEARCH_MARKER = "BLUEBELLY_SOURCE_ONLY_V1" as const;

export function scheduledSourceOnlyEnabled(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env.BLUEBELLY_SOURCE_ONLY_RESEARCH_DISABLED !== "true";
}

export function sourceOnlyCompletionDecision(input: {
  accuracyGate: "open" | "review" | "blocked" | string;
  sourceChecks: unknown;
}) {
  const sourceChecksPresent = Array.isArray(input.sourceChecks) && input.sourceChecks.length > 0;
  const structurallyBlocked = input.accuracyGate === "blocked";
  return {
    status: (structurallyBlocked || !sourceChecksPresent ? "blocked" : "completed") as "completed" | "blocked",
    sourceChecksPresent,
    warning: !sourceChecksPresent
      ? "SOURCE_ONLY_COVERAGE_UNPROVEN: no persisted acquisition source checks; run is blocked."
      : structurallyBlocked
      ? "SOURCE_ONLY_ACCURACY_BLOCKED: sources retained; structural market-data gate did not pass."
      : "SOURCE_ONLY_ACQUISITION_COMPLETE: dated source receipts persisted; no automatic intelligence, Story publication or Daily Intelligence edition requested.",
  };
}
