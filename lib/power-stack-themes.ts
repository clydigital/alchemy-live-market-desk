import { createHash } from "node:crypto";

import { type IntakeItemInput } from "@/lib/research-update";

const POWER_STACK_THEMES_URL = "https://clydigital.github.io/power-stack/themes.html";
const POWER_STACK_FEED_URL = "https://clydigital.github.io/power-stack/data/developing-themes.json";
const MAX_THEME_ITEMS = 12;
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

function themeKey(theme: PowerStackTheme) {
  const identity = `${theme.id || theme.name || "theme"}:${theme.lastUpdated || "unknown"}`;
  return `power-stack:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function themeUrl(theme: PowerStackTheme) {
  const id = String(theme.id || "").trim();
  return id ? `${POWER_STACK_THEMES_URL}#${encodeURIComponent(id)}` : POWER_STACK_THEMES_URL;
}

function publisher(news: PowerStackNews) {
  return news.publisher || news.sourceLabel || news.sourceName || news.source || "Power Stack linked source";
}

function adjacencySummary(theme: PowerStackTheme) {
  const watch = unique(theme.watch || []).slice(0, 12);
  const assets = unique([...(theme.powerStackTickers || []), ...(theme.researchCandidates || [])]).slice(0, 16);
  const status = unique([theme.direction, theme.status]).join(" · ");
  const parts = [
    "Power Stack thematic radar lead only. Do not treat this internal radar as independent corroboration; verify deciding claims through the linked evidence and other canonical sources.",
    theme.summary ? `Theme: ${theme.summary}` : null,
    theme.whyDeveloping ? `Why developing: ${theme.whyDeveloping}` : null,
    status ? `Theme state: ${status}.` : null,
    watch.length ? `Adjacent news and data to test before changing a Story: ${watch.join("; ")}.` : null,
    assets.length ? `Adjacent assets and research candidates to cross-check: ${assets.join(", ")}.` : null,
    "Think one causal step upstream and downstream: physical constraints, policy, financing, cross-asset confirmation, earnings/calendar catalysts and second-order beneficiaries or losers. If the needed adjacent evidence is absent, preserve it as a research gap rather than inferring it.",
  ];
  return parts.filter(Boolean).join("\n\n");
}

function themeEvidence(theme: PowerStackTheme, fallbackDate: Date) {
  return (Array.isArray(theme.mainNews) ? theme.mainNews : []).flatMap((news) => {
    const url = validHttpsUrl(news.url);
    const title = news.title || news.headline;
    if (!url || !title) return [];
    const implication = news.implication?.trim();
    return [{
      title: title.slice(0, 500),
      url,
      publisher: publisher(news).slice(0, 160),
      publishedAt: isoDate(news.date, fallbackDate),
      claim: `${title}${implication ? `. Research implication: ${implication}` : ""}`.slice(0, 1_000),
    }];
  });
}

function themeItem(theme: PowerStackTheme, fallbackDate: Date): IntakeItemInput | null {
  const name = theme.name?.trim();
  if (!name) return null;
  const publishedAt = isoDate(theme.lastUpdated, fallbackDate);
  const summary = adjacencySummary(theme);
  return {
    itemKey: themeKey(theme),
    itemType: "news",
    publisher: "Power Stack Themes",
    externalId: theme.id || name,
    title: `Power Stack adjacency radar: ${name}`.slice(0, 500),
    url: themeUrl(theme),
    publishedAt,
    summary,
    sourceQuality: 56,
    relevance: 74,
    novelty: 68,
    materiality: 66,
    recommendedAction: "collect_evidence",
    newsSignal: "Auxiliary Power Stack thematic radar. Use it to widen the research queue, not as standalone proof.",
    divergenceKind: "none",
    evidence: themeEvidence(theme, fallbackDate),
    reviewReason: "Internal thematic radar used to surface adjacent news, data and causal links. Its own synthesis must not self-corroborate Live; only traceable linked evidence or independently acquired evidence may decide a canonical Story change.",
  };
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
    const themes = Array.isArray(payload.themes) ? payload.themes : [];
    const freshThemes = themes
      .filter((theme) => {
        if (!theme.lastUpdated) return true;
        const updated = Date.parse(theme.lastUpdated);
        return Number.isFinite(updated) && now.getTime() - updated <= THEME_MAX_AGE_MS;
      })
      .slice(0, MAX_THEME_ITEMS);
    const items = freshThemes.flatMap((theme) => {
      const item = themeItem(theme, now);
      return item ? [item] : [];
    });
    return {
      items,
      note: items.length
        ? `Power Stack auxiliary thematic radar loaded ${items.length} active theme${items.length === 1 ? "" : "s"}; themes seed adjacency checks but do not count as independent corroboration.`
        : "Power Stack auxiliary thematic radar loaded successfully but returned no fresh active themes.",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown acquisition failure";
    return {
      items: [],
      note: `Power Stack auxiliary thematic radar unavailable (${detail.slice(0, 240)}); canonical research continues without blocking the run.`,
    };
  }
}
