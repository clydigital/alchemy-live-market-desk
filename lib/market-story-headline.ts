/**
 * Reader-facing Story headlines must be declarative and must never convert an
 * unresolved research question into an asserted market event.
 * Inputs are existing authored or canonically sourced text, not generated copy.
 */
const QUESTION_OPENING = /^(?:what|why|how|when|where|who|whom|whose|which|will|would|could|should|can|does|do|did|is|are|was|were)\b/i;

function declarative(value: string | null | undefined): string | null {
  const title = value?.replace(/\s+/g, " ").trim() || "";
  return title && !/[?？]/.test(title) && !QUESTION_OPENING.test(title)
    && !/^market development awaiting verified headline$/i.test(title) ? title : null;
}

export function marketStoryHeadline(candidates: ReadonlyArray<string | null | undefined>): string {
  // Deliberately do not recast questions as facts. Keep those in the Story body.
  // A research workflow status is not a news headline. If all candidates are
  // questions, defer to an exact, source-admitted reported observation in the
  // editorial reader. If no fact exists, the public Story is withheld.
  const title = candidates.map(declarative).find((value): value is string => Boolean(value)) || "";
  const chars = Array.from(title);
  if (chars.length <= 80) return title;
  const prefix = chars.slice(0, 79).join("").trimEnd();
  const boundary = prefix.lastIndexOf(" ");
  return (boundary >= 24 ? prefix.slice(0, boundary) : prefix).trimEnd() + "…";
}
