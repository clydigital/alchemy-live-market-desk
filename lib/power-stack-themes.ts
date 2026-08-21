import { createHash } from "node:crypto";

import { type IntakeItemInput } from "@/lib/research-update";

const POWER_STACK_FEED_URL = "https://clydigital.github.io/power-stack/data/developing-themes.json";
const MAX_THEMES = 12;
const MAX_WATCH_LEADS = 8;
const MAX_LEADS_PER_THEME = 2;
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
  return `power-stack-watch:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;
}

function watchContext(theme: PowerStackTheme) {
  const checks = unique(theme.watch || []).slice(0, 2);
  const themeName = theme.name || theme.id || "developing theme";
  return [
    `Power Stack developing-theme watch only for ${themeName}.`,
    "Check whether independently acquired Live news or data materially changed this theme since the previous research cycle.",
    checks.length ? `Useful adjacent checks if normal Live sources surface the theme: ${checks.join("; ")}.` : null,
    "Power Stack itself is not evidence, corroboration, a confidence input or a publication driver.",
  ].filter(Boolean).join(" ");
}

function linkedWatchItems(theme: PowerStackTheme, fallbackDate: Date): IntakeItemInput[] {
  const context = watchContext(theme);
  return (Array.isArray(theme.mainNews) ? theme.mainNews : []).slice(0, MAX_LEADS_PER_THEME).flatMap((news) => {
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
      summary: `Developing-theme watch lead: ${title}`.slice(0, 2_000),
      // These scores are descriptive only. recommendedAction="ignore" is
      // intentional: the canonicaliser excludes ignored intake rows, which
      // keeps Power Stack out of the evidence pool while preserving an
      // auditable record that the developing-theme watchlist was scanned.
      sourceQuality: 35,
      relevance: 35,
      novelty: 30,
      materiality: 30,
      recommendedAction: "ignore",
      newsSignal: "Developing-theme watchlist marker from Power Stack; discovery context only.",
      divergenceKind: "none",
      divergenceNote: context.slice(0, 2_000),
      evidence: [],
      reviewReason: "Power Stack is a developing-theme read-through only. This row is deliberately excluded from canonical evidence. Any material update must arrive independently through Live's normal news, official-data, market-data or specialist-source intake before it can affect reasoning.",
    }];
  });
}

export async function acquirePowerStackThemes(now = new Date()): Promise<PowerStackThemeAcquisition> {
  try {
    const response = await fetch(POWER_STACK_FEED_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Alchemy Live Desk developing-theme watchlist",
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
      .sort((a, b) => Date.parse(b.lastUpdated || "") - Date.parse(a.lastUpdated || ""))
      .slice(0, MAX_THEMES);
    const items = themes.flatMap((theme) => linkedWatchItems(theme, now)).slice(0, MAX_WATCH_LEADS);
    const themesWithWatchLeads = themes.filter((theme) => linkedWatchItems(theme, now).length > 0).length;
    return {
      items,
      note: `Power Stack watchlist scanned ${themes.length} developing theme${themes.length === 1 ? "" : "s"}; recorded ${items.length} watch lead${items.length === 1 ? "" : "s"} across ${themesWithWatchLeads} theme${themesWithWatchLeads === 1 ? "" : "s"}. These rows are excluded from canonical evidence. Independent Live sources must surface and confirm any material change.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown acquisition failure";
    return {
      items: [],
      note: `Power Stack developing-theme watchlist unavailable (${detail.slice(0, 240)}); canonical research continues without blocking the run.`,
    };
  }
}
