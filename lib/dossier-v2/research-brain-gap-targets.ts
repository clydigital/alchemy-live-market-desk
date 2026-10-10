/**
 * Clerical Research Gap target repair for Research Brain V1.
 *
 * "handed off" != "measured" != "conclusion changed". A BLOCKER may only
 * reference the current Main Thread, current Regime, or a Major Story actually
 * emitted in this Dossier output. Historical, conjectured or investigation IDs
 * cannot be silently made current Story conclusions.
 *
 * This repairs only malformed references, never evidence authority, Motion A2,
 * market direction, the finding itself, or the canonical Story version.
 */
export function normalizeResearchBrainGapTargets(output: unknown): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output)) return output;
  const root = output as Record<string, unknown>;
  if (!Array.isArray(root.research_gaps) || !Array.isArray(root.major_stories)) return output;
  const valid = new Set<string>(["MAIN_THREAD", "REGIME:CURRENT"]);
  for (const story of root.major_stories) {
    if (!story || typeof story !== "object" || Array.isArray(story)) continue;
    const id = (story as Record<string, unknown>).story_id;
    if (typeof id === "string" && id.trim()) valid.add("STORY:" + id);
  }

  const diagnostics = root.diagnostics;
  let edited = 0;
  let demoted = 0;
  const audits: string[] = [];

  for (const rawGap of root.research_gaps) {
    if (!rawGap || typeof rawGap !== "object" || Array.isArray(rawGap)) continue;
    const gap = rawGap as Record<string, unknown>;
    // Do not "fix" structurally invalid gaps: deterministic validation retains
    // authority over missing, incorrectly typed or mismatched fields.
    if (gap.gap_class !== "BLOCKER" || gap.severity !== "MATERIAL"
      || !Array.isArray(gap.blocking_refs) || gap.blocking_refs.length === 0
      || !gap.blocking_refs.every((x): x is string => typeof x === "string")
      || typeof gap.gap_id !== "string" || !gap.gap_id.trim()
      || typeof gap.description !== "string" || !gap.description.trim()) continue;
    const before = gap.blocking_refs as string[];
    const accepted = [...new Set(before.filter((ref) => valid.has(ref)))];
    const invalid = [...new Set(before.filter((ref) => !valid.has(ref)))];
    if (!invalid.length) continue;
    // Never replace a false reference with MAIN_THREAD or REGIME:CURRENT:
    // doing that would falsely claim the gap blocks a real conclusion.
    gap.blocking_refs = accepted;
    if (accepted.length === 0) {
      gap.gap_class = "REFINEMENT";
      gap.severity = "INFORMATIONAL";
      demoted++;
    }
    edited++;
    audits.push(
      "Research Gap " + gap.gap_id
      + ": ungrounded blocker reference(s) " + invalid.map((ref) => JSON.stringify(ref)).join(", ")
      + (accepted.length ? " removed; verified blocker retained." :
        " removed; remains an unresolved investigation, NOT a validated conclusion blocker."),
    );
  }

  if (edited && diagnostics && typeof diagnostics === "object" && !Array.isArray(diagnostics)) {
    const record = diagnostics as Record<string, unknown>;
    // Preserve a transparent audit without falsely claiming a model retry.
    if (Array.isArray(record.omitted_or_demoted_items)) {
      record.omitted_or_demoted_items.push(...audits);
    }
    if (Array.isArray(record.notes)) {
      record.notes.push(
        edited + " invalid Research Gap blocker target(s) were clerically corrected; "
        + demoted + " question(s) remain unresolved without a valid blocking conclusion. "
        + "A processed Research Gap is not proof of measured evidence or market resolution.",
      );
    }
  }

  if (edited) {
    console.info(JSON.stringify({
      event: "research_brain_gap_target_normalization",
      correctedGapCount: edited,
      demotedToUnresolvedRefinement: demoted,
      // IDs are research questions, not canonical Story or evidence links.
      invalidTargetRefs: audits,
    }));
  }
  return output;
}
