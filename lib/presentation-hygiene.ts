export type PresentationAgeState = "current" | "historical";

export function readerFacingText(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) return null;
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(text)) return null;
  if (/^(?:material evidence recalibration|story updated|story created|thesis bearing story field changed)$/i.test(text)) return null;
  return text;
}

export function presentationAge(
  timestamp: string | null | undefined,
  now: Date = new Date(),
  historicalAfterDays = 7,
) {
  const parsed = Date.parse(timestamp || "");
  if (!Number.isFinite(parsed)) {
    return { ageState: "current" as PresentationAgeState, ageLabel: null, ageDays: null };
  }
  const ageDays = Math.max(0, Math.floor((now.getTime() - parsed) / 86_400_000));
  if (ageDays < historicalAfterDays) {
    return { ageState: "current" as PresentationAgeState, ageLabel: null, ageDays };
  }
  return {
    ageState: "historical" as PresentationAgeState,
    ageLabel: `${ageDays}d ago`,
    ageDays,
  };
}
