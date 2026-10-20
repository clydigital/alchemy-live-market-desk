import type { DossierV2InputPacket } from "./input-packet.ts";
import { auditCpiSurprises } from "./cpi-surprise-audit.ts";

/**
 * An existing output-validation rule, not a new reasoning engine.
 * Rejects explicitly stated headline-monthly upside surprises that do not
 * have a matching above-forecast canonical comparison.
 */
export function cpiSurpriseNarrativeErrors(
  text: string,
  packet: DossierV2InputPacket,
): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const audit = auditCpiSurprises(packet);
  const errors: string[] = [];
  for (const sentence of sentences) {
    // Do not punish prose explicitly disputing the mistaken claim.
    if (/\b(?:incorrect|wrong|false)\s+to\s+(?:say|claim)\b/i.test(sentence)
      || /\bCPI\b[^.!?]{0,24}\b(?:did\s+not|was\s+not|has\s+not)\b[^.!?]{0,24}\bsurpris/i.test(sentence)) continue;
    // Core-specific explanations must not be mistaken for headline claims.
    if (/\bcore\s+cpi\b/i.test(sentence) && !/\bheadline\s+cpi\b/i.test(sentence)) {
      continue;
    }
    const match = sentence.match(
      /\b(?:headline\s+)?CPI\b[^.!?]{0,100}\b(?:surpris(?:e|ed|ing)|hotter\s+than\s+expected|above\s+(?:forecast|consensus)|beat(?:s|ing)?\s+(?:forecast|consensus))\b[^.!?]{0,90}?\+?(\d+(?:\.\d+)?)\s*%\s*(?:m\/m|mom)\b/i,
    );
    if (!match) continue;
    const asserted = Number(match[1]);
    if (!Number.isFinite(asserted)) continue;
    const provedAbove = audit.some(item =>
      item.measure === "HEADLINE_MOM"
      && Math.abs(item.observed_pct - asserted) < 0.0001
      && item.outcome === "ABOVE_FORECAST"
      && item.expected_pct !== null);
    if (provedAbove) continue;
    errors.push(
      "Unsupported headline CPI upside-surprise claim (" + asserted + "% m/m). " +
      "Canonical metric-specific evidence does not show headline ABOVE_FORECAST. " +
      "The previous month's CPI is NOT the expected forecast. " +
      "Rewrite without a headline surprise and, when supported, distinguish " +
      "core CPI actual versus core forecast with exact evidence references.",
    );
  }
  return errors;
}
