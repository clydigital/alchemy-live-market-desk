import type { VisualPayload } from "./bluebelly-visual-evidence.ts";
import { isPublicVisualEligible, parseVisualPayload } from "./bluebelly-visual-evidence.ts";

export interface VisualProjection {
  visual: VisualPayload;
  columns: string[];
  rows: (string | number | null)[][];
  sourceLinks: { publisher: string; url: string; observedAt: string }[];
}

/** Pure publication adapter. Caller must separately enforce article/edition publication access. */
export function projectVisualForReader(input: unknown, visibility: "public" | "owner"): VisualProjection | null {
  const visual = visibility === "public"
    ? (isPublicVisualEligible(input) ? parseVisualPayload(input) : null)
    : parseVisualPayload(input);
  if (!visual) return null;
  // Charts must always have a readable, inspectable table fallback.
  // Reject inconsistent series lengths rather than silently misaligning values.
  if (visual.kind !== "table") {
    if (visual.columns.length < 1 || visual.rows.length === 0) return null;
    if (visual.series.some(s => s.values.length !== visual.rows.length)) return null;
  }
  return {
    visual,
    columns: [...visual.columns],
    rows: visual.rows.map(row => [...row]),
    sourceLinks: visual.sources.map(s => ({ publisher: s.publisher, url: s.url, observedAt: s.observed_at }))
  };
}

/** Escape HTML special characters for Notion-compatible portable fallback markup. */
export function escapeVisualText(value: string | number | null): string {
  const raw = value === null ? "Unavailable" : String(value);
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** A portable, non-script table fallback. Does not publish or call Notion. */
export function visualTableHtml(projection: VisualProjection): string {
  const v = projection.visual;
  const headers = projection.columns.map(c => `<th scope="col">${escapeVisualText(c)}</th>`).join("");
  const body = projection.rows.map(row =>
    `<tr>${row.map(cell => `<td>${escapeVisualText(cell)}</td>`).join("")}</tr>`
  ).join("");
  const links = projection.sourceLinks.map(s =>
    `<li><a href="${escapeVisualText(s.url)}" rel="noopener noreferrer">${escapeVisualText(s.publisher)}</a> — ${escapeVisualText(s.observedAt)}</li>`
  ).join("");
  return `<figure data-visual-id="${escapeVisualText(v.visual_id)}"><figcaption><strong>${escapeVisualText(v.title)}</strong> — ${escapeVisualText(v.description)}</figcaption><div style="overflow-x:auto"><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div><p>Unit: ${escapeVisualText(v.unit)} · As of: ${escapeVisualText(v.as_of_et)} · Basis: ${escapeVisualText(v.period_basis)}</p><ul>${links}</ul></figure>`;
}
