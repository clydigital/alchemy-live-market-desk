type MaterialGap = { severity: string; description: string };

/** Current Dossier context for a historical CPI Story event; never alters the event. */
export function cpiStoryEvidenceCaveat(input: {
  storyTitle: string;
  eventAt: string;
  dossierId: string | null;
  dossierAsOf: string | null;
  gaps: MaterialGap[];
}): string | null {
  if (!/\bCPI\b/i.test(input.storyTitle) || !/front.end|Fed repricing/i.test(input.storyTitle)) return null;
  const eventTime = Date.parse(input.eventAt);
  const asOfTime = Date.parse(input.dossierAsOf || "");
  if (!Number.isFinite(eventTime) || !Number.isFinite(asOfTime) || asOfTime < eventTime || !input.dossierId) return null;

  const gap = input.gaps.find((item) => {
    if (item.severity.toUpperCase() !== "MATERIAL") return false;
    if (!/\bCPI\b/i.test(item.description) || !/intraday/i.test(item.description)) return false;
    const normalisedDescription = item.description.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-");
    const releaseDate = normalisedDescription.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0];
    // Bind the gap to the event's release session, allowing UTC dates on either
    // side of the New York release day. An unrelated CPI gap cannot relabel it.
    if (!releaseDate) return false;
    const releaseTime = Date.parse(`${releaseDate}T00:00:00Z`);
    return eventTime >= releaseTime && eventTime < releaseTime + 2 * 86400000;
  });
  if (!gap) return null;

  return `UNRESOLVED in current Dossier ${input.dossierId} (as of ${input.dossierAsOf}): `
    + `the front-end repricing mechanism and relative causal weight are not confirmed. ${gap.description}`;
}
