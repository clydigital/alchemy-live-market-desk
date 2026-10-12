/**
 * Advisory LY-style headline audit. Market facts and causal conclusions remain
 * owned by the Dossier. Style warnings never change a conclusion, Evidence ref,
 * confidence, or the ability to persist a valid Dossier.
 *
 * Rules follow the supplied LY Style Guide and approved China/Brent revision:
 * name the market development first; move unexplained jargon and numbers into
 * the supporting paragraph; explain one cause at a time.
 */
export type LYHeadlineIssue =
  | "INTERNAL_VOCABULARY"
  | "INSTITUTIONAL_SHORTCUT"
  | "TECHNICAL_LEAD"
  | "DENSE_HEADLINE";

export function auditLYHeadline(headline: string): LYHeadlineIssue[] {
  const text = headline.trim();
  if (!text) return [];
  const issues: LYHeadlineIssue[] = [];
  if (/\b(governed|canonical|system\s*[12]|epistemic|adjudicat(?:e|ion|ed))\b/i.test(text)) {
    issues.push("INTERNAL_VOCABULARY");
  }
  if (/\btransmiss(?:ion|ions)|\b(?:credit|breadth|liquidity)\s+(?:remain(?:s)?\s+)?unresolved\b|\bunresolved\s+(?:credit|breadth|liquidity)\b/i.test(text)) {
    issues.push("INSTITUTIONAL_SHORTCUT");
  }
  if (/^(?:the\s+)?(?:ny\s+fed\s+acm|acm\s+model|modelled\s+term\s+premium)\b/i.test(text)) {
    issues.push("TECHNICAL_LEAD");
  }
  // Dashboard headlines are not full research summaries. Detail belongs below.
  if (text.length > 125) issues.push("DENSE_HEADLINE");
  return issues;
}

export function noteLYHeadlineIssues<T extends {
  main_thread: { headline: string };
  diagnostics: { notes: string[] };
}>(output: T): T {
  const issues = auditLYHeadline(output.main_thread.headline);
  if (!issues.length) return output;
  const message = `LY_HEADLINE_REVIEW_REQUIRED: ${issues.join(", ")}`;
  output.diagnostics.notes = [...new Set([...(output.diagnostics.notes ?? []), message])];
  return output;
}
