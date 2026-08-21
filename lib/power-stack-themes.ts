import { createHash } from "node:crypto";

import { type IntakeItemInput } from "@/lib/research-update";

const POWER_STACK_FEED_URL = "https://clydigital.github.io/power-stack/data/developing-themes.json";
const MAX_THEMES = 12;
const MAX_RADAR_ITEMS = 18;
const THEME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;

type PowerStackNews = {
  date?: string;
  title?: string;
  headline?: string;
  source?: string;
  publisher?: string;
  sourceLabel?: string;
  sourceName?: string;
  url?: string;
  implication?: string;
};

type PowerStackTheme = {
  id?: string;
  name?: string;
  status?: string;
  direction?: string;
  lastUpdated?: string;
  summary?: string;
  whyDeveloping?: string;
  powerStackTickers?: string[];
  researchCandidates?: string[];
  watch?: string[];
  mainNews?: PowerStackNews[];
};

type PowerStackPayload = {
  lastUpdated?: string;
  purpose?: string;
  themes?: PowerStackTheme[];
};

export type PowerStackThemeAcquisition = {
  items: IntakeItemInput[];
  note: string;
};

function isoDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback.toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback.toISOString();
}

function validHttpsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function publisher(news: PowerStackNews) {
  return news.publisher || news.sourceLabel || news.sourceName || news.source || "Linked source";
}

function itemKey(theme: PowerStackTheme, url: string, publishedAt: string) {
  const identity = `${theme.id || theme.name || "theme"}|${url}|${publishedAt}`;
  return `power-stack-lead:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function adjacencyContext(theme: PowerStackTheme) {
  const watch = unique(theme.watch || []).slice(0, 12);
  const assets = unique([...(theme.powerStackTickers || []), ...(theme.researchCandidates || [])]).slice(0, 16);
  const context = [
    `Power Stack discovery context only${theme.name ? ` for ${theme.name}` : ""}; this context is not evidence and must not self-corroborate Live.`,
    watch.length ? `Adjacent news and data to check: ${watch.join("; ")}.` : null,
    assets.length ? `Adjacent assets to cross-check: ${assets.join(", ")}.` : null,
    "Test one causal step upstream and downstream: physical constraints, policy, financing, cross-asset confirmation, earnings or calendar catalysts, and second-order beneficiaries or losers. Preserve missing adjacent evidence as a research gap rather than inferring it.",
  ];
  return context.filter(Boolean).join(" ");
}

function linkedItems(theme: PowerStackTheme, fallbackDate: Date): IntakeItemInput[] {
  const context = adjacencyContext(theme);
  return (Array.isArray(theme.mainNews) ? theme.mainNews : []).flatMap((news) => {
    const url = validHttpsUrl(news.url);
    const title = (news.title || news.headline || "").trim();
    if (!url || !title) return [];
    const publishedAt = isoDate(news.date || theme.lastUpdated, fallbackDate);
    const source = publisher(news).slice(0, 160);
    return [{
      itemKey: itemKey(theme, url, publishedAt),
      itemType: "news",
      publisher: source,
      externalId: url,
      title: title.slice(0, 500),
      url,
      publishedAt,
      // Canonical claim text remains the linked source headline. Power Stack's
      // own thematic synthesis is deliberately kept out of the evidence claim.
      summary: title.slice(0, 2_000),
      sourceQuality: 68,
      relevance: 72,
      novelty: 68,
      materiality: 64,
      recommendedAction: "collect_evidence",
      newsSignal: "Underlying source discovered through the auxiliary Power Stack thematic radar.",
      divergenceKind: "none",
      divergenceNote: context.slice(0, 2_000),
      evidence: [{
        title: title.slice(0, 500),
        url,
        publisher: source,
        publishedAt,
        claim: title.slice(0, 1_000),
      }],
      reviewReason: "Power Stack is acting only as a discovery and adjacency layer. The linked source carries the traceable evidence; Power Stack's internal synthesis must never count as a separate corroborating source.",
    }];
  });
}

export async function acquirePowerStackThemes(now = new Date()): Promise<PowerStackThemeAcquisition> {
  try {
    const response = await fetch(POWER_STACK_FEED_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Alchemy Live Desk thematic adjacency research",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as PowerStackPayload;
    const themes = (Array.isArray(payload.themes) ? payload.themes : [])
      .filter((theme) => {
        if (!theme.lastUpdated) return true;
        const updated = Date.parse(theme.lastUpdated);
        return Number.isFinite(updated) && now.getTime() - updated <= THEME_MAX_AGE_MS;
      })
      .slice(0, MAX_THEMES);
    const items = themes.flatMap((theme) => linkedItems(theme, now)).slice(0, MAX_RADAR_ITEMS);
    const themesWithLinkedEvidence = themes.filter((theme) => linkedItems(theme, now).length > 0).length;
    return {
      items,
      note: items.length
        ? `Power Stack auxiliary radar surfaced ${items.length} linked source item${items.length === 1 ? "" : "s"} across ${themesWithLinkedEvidence} active theme${themesWithLinkedEvidence === 1 ? "" : "s"}. Power Stack itself is not persisted as canonical evidence; it only widens adjacent-news and adjacent-data checks.`
        : "Power Stack auxiliary radar loaded successfully but exposed no fresh traceable linked source items.",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown acquisition failure";
    return {
      items: [],
      note: `Power Stack auxiliary radar unavailable (${detail.slice(0, 240)}); canonical research continues without blocking the run.`,
    };
  }
}
