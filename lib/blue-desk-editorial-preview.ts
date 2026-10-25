/** Short extract from an approved editorial edition, never machine-inferred analysis. */
export function approvedEditorialLead(body: string, maxLength = 520): string {
  const paragraph = body
    .split(/\n\s*\n/)
    .map(text => text.trim())
    .find(text => text.length > 0 && !/^#{1,6}\s/.test(text)) || "";
  if (paragraph.length <= maxLength) return paragraph;
  const clipped = paragraph.slice(0, maxLength);
  const sentenceEnd = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "));
  if (sentenceEnd >= 140) return clipped.slice(0, sentenceEnd + 1).trim();
  return clipped.replace(/\s+\S*$/, "").trimEnd() + "…";
}
