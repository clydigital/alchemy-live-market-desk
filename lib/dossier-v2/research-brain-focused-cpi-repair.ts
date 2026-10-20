import type { DossierV2InputPacket } from "./input-packet.ts";

/**
 * Narrow exception to full-schema Research Brain repair. Only the runtime-
 * reproduced combination of a false headline-monthly CPI surprise and
 * independently identified structural source-reference errors is eligible.
 * Unknown validation errors must continue through the existing full repair.
 */
const CPI_ERROR = "Unsupported headline CPI upside-surprise claim (0.6% m/m).";
const LENS_ERROR = /^market_verdict lens "([^"]+)" non-null observed_reaction requires at least one market\/pricing evidence reference \(e\.g\., PRICING_FEED, MARKET_DATA, YIELD\)\.$/;
const CANDIDATE_ERROR = /^investigations\[(\d+)\] \(([^)]*)\) candidate_explanations\[(\d+)\]\.(evidence_for_ids|evidence_against_ids) references evidence outside this Investigation's observed_evidence: "([^"]+)"\.$/;

export function isFocusedCpiRepairEligible(errors: string[]): boolean {
  return errors.length > 0
    && errors.length <= 8
    && errors.some((error) => error.startsWith(CPI_ERROR))
    && errors.every((error) =>
      error.startsWith(CPI_ERROR)
      || LENS_ERROR.test(error)
      || CANDIDATE_ERROR.test(error));
}

export function buildFocusedCpiRepairRequest(
  output: unknown,
  errors: string[],
  packet: DossierV2InputPacket,
  cpiAudit: unknown,
) {
  if (!isFocusedCpiRepairEligible(errors)
    || !output || typeof output !== "object" || Array.isArray(output)) return null;
  const root = output as Record<string, unknown>;
  const mainThread = root.main_thread;
  if (!mainThread || typeof mainThread !== "object" || Array.isArray(mainThread)) return null;
  const main = mainThread as Record<string, unknown>;
  if (typeof main.headline !== "string" || typeof main.answer !== "string") return null;

  return {
    instructions: `You are performing the single permitted bounded Research Brain validation repair. The original full Dossier is already constructed. Return ONLY corrected headline and answer strings for main_thread in the required JSON schema; never regenerate any other Dossier field.

Fix the validator's erroneous headline-monthly CPI upside-surprise wording, without changing the analytical conclusion or fabricating any market, source, forecast, date, unit or evidence reference. The previous month's CPI is NOT the expected consensus. If a matching independently timestamped pre-release headline monthly comparator is absent, say only the actual CPI print or omit the surprise claim. A source-reported core CPI monthly forecast comparison must be distinguished from headline CPI. Preserve the existing answer's other evidence-qualified assertions. Never portray daily real yields as the intraday CPI reaction. Do not mention the validator or research workflow. British English, concise market prose. Return no extra fields.`,
    boundedInput: {
      packet_id: packet.packet_id,
      as_of: packet.as_of,
      current_main_thread: {
        headline: main.headline,
        answer: main.answer,
        evidence_references: main.evidence_references,
      },
      metric_specific_cpi_audit: cpiAudit,
      validation_errors: errors.filter((error) => error.startsWith(CPI_ERROR)),
    },
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "answer"],
      properties: { headline: { type: "string" }, answer: { type: "string" } },
    },
  };
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Apply only explicitly flagged deletions/demotions and the two edited text
 * fields. Caller MUST run the complete original Research Brain validator
 * afterward. No evidence, Story, thesis, Motion or data is invented.
 */
export function applyFocusedCpiRepair(
  invalidOutput: unknown,
  correction: unknown,
  errors: string[],
): unknown | null {
  if (!isFocusedCpiRepairEligible(errors) || !plainObject(invalidOutput) || !plainObject(correction)) return null;
  if (Object.keys(correction).sort().join(",") !== "answer,headline") return null;
  if (typeof correction.headline !== "string" || typeof correction.answer !== "string"
    || !correction.headline.trim() || !correction.answer.trim()
    || correction.headline.length > 600 || correction.answer.length > 3_000) return null;
  const root = structuredClone(invalidOutput) as Record<string, unknown>;
  if (!plainObject(root.main_thread)) return null;
  root.main_thread.headline = correction.headline;
  root.main_thread.answer = correction.answer;

  for (const error of errors) {
    if (error.startsWith(CPI_ERROR)) continue;
    const lensMatch = error.match(LENS_ERROR);
    if (lensMatch) {
      const mv = root.market_verdict;
      if (!plainObject(mv) || !plainObject(mv.lenses)
        || !plainObject(mv.lenses[lensMatch[1]])) return null;
      const lens = mv.lenses[lensMatch[1]] as Record<string, unknown>;
      // Unsupported observed tape must never be retained as market evidence.
      lens.observed_reaction = null;
      lens.observed_reaction_evidence_refs = [];
      continue;
    }
    const candidateMatch = error.match(CANDIDATE_ERROR);
    if (!candidateMatch || !Array.isArray(root.investigations)) return null;
    const [index, identity, candidateIndex, side, unsupportedId] = [
      Number(candidateMatch[1]), candidateMatch[2], Number(candidateMatch[3]),
      candidateMatch[4], candidateMatch[5],
    ];
    const investigation = root.investigations[index];
    if (!plainObject(investigation) || investigation.investigation_id !== identity
      || !Array.isArray(investigation.candidate_explanations)) return null;
    const candidate = investigation.candidate_explanations[candidateIndex];
    if (!plainObject(candidate) || !Array.isArray(candidate[side])
      || !candidate[side].includes(unsupportedId)) return null;
    const keptEvidence = (candidate[side] as unknown[]).filter((id) => id !== unsupportedId);
    candidate[side] = keptEvidence;
    if (side === "evidence_for_ids" && keptEvidence.length === 0
      && (candidate.confidence === "HIGH" || candidate.confidence === "MEDIUM")) {
      candidate.confidence = "UNRESOLVED";
    }
  }
  return root;
}
