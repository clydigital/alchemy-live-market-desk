import { createSupabaseAdminClient } from "./supabase/admin";

export const STOCKEDUP_EVIDENCE_BRIEF_V1 = "stockedup-evidence-brief/1" as const;

export type StockedUpEvidenceItem = {
  id: string;
  status: "VERIFIED" | "PARTIAL" | "CREATOR_ONLY";
  title: string;
  detail: string;
  sourceName: string | null;
  sourceUrl: string | null;
  affectedAssets: string[];
  confidence: number | null;
};

export type StockedUpEvidenceBriefV1 = {
  contractVersion: typeof STOCKEDUP_EVIDENCE_BRIEF_V1;
  reportLabel: string;
  asOf: string;
  summary: string;
  verified: StockedUpEvidenceItem[];
  partial: StockedUpEvidenceItem[];
  creatorOnly: StockedUpEvidenceItem[];
};

type EvidenceRow = {
  external_evidence_id: string | null;
  claim_text: string;
  available_at: string | null;
  affected_assets: string[] | null;
  confidence: number | string | null;
  provenance_urls: string[] | null;
  source:
    | {
        source_name: string | null;
        source_url: string | null;
      }
    | Array<{
        source_name: string | null;
        source_url: string | null;
      }>
    | null;
};

function sourceFor(row: EvidenceRow) {
  const source = Array.isArray(row.source) ? row.source[0] : row.source;
  return {
    sourceName: source?.source_name ?? null,
    sourceUrl: source?.source_url ?? row.provenance_urls?.[0] ?? null,
  };
}

function titleFor(id: string) {
  if (id.includes("rates-2026-09-24")) return "Long-end Treasury stress";
  if (id.includes("natgas-storage")) return "Natural-gas storage tightened";
  if (id.includes("diesel-export-policy")) return "Diesel export-policy risk";
  if (id.includes("us-china-truce")) return "US–China tariff cliff pushed out";
  if (id.includes("us-iran-talks")) return "US–Iran diplomacy is active";
  if (id.includes("houthi-saudi")) return "Saudi/Houthi energy risk persists";
  if (id.includes("global-bond-yields")) return "Duration stress is global";
  if (id.includes("spx-concentration")) return "S&P concentration remains extreme";
  if (id.includes("midterm-seasonality")) return "Late-September midterm seasonality";
  if (id.includes("nbis-upgrade")) return "NBIS analyst catalyst verified";
  if (id.includes("meta-muse")) return "META Muse catalyst verified";
  if (id.includes("rklb-nitestar")) return "RKLB defence-space catalyst verified";
  return "Verified StockedUp claim";
}

const PARTIAL: StockedUpEvidenceItem[] = [
  {
    id: "stockedup-partial-us-iran-terms",
    status: "PARTIAL",
    title: "Exact Hormuz-for-sanctions deal terms",
    detail:
      "Active US–Iran diplomacy is verified, but the transcript's specific exchange — reopening Hormuz for lifting the economic blockade plus frozen-asset access — is not independently confirmed.",
    sourceName: "StockedUp transcript + Reuters verification",
    sourceUrl: null,
    affectedAssets: ["CL1!", "BZ1!", "SPX", "XAUUSD"],
    confidence: 60,
  },
  {
    id: "stockedup-partial-seasonality",
    status: "PARTIAL",
    title: "Week 39 as the exact worst S&P week",
    detail:
      "Independent work supports late-September weakness in midterm years, but the exact 'week 39 is worst since 1950, -0.5% average, positive under 50%' statistic has not been reproduced from a primary historical series.",
    sourceName: "StockedUp transcript + independent seasonality context",
    sourceUrl: null,
    affectedAssets: ["SPX", "SPY"],
    confidence: 55,
  },
];

const CREATOR_ONLY: StockedUpEvidenceItem[] = [
  {
    id: "stockedup-creator-spy-levels",
    status: "CREATOR_ONLY",
    title: "SPY tactical map",
    detail:
      "Creator levels remain 762 / 763.5 support, 766.5 resistance and 769 breakout, with 770 → 772 → 775 as upside extensions. They are displayed as creator technicals only and do not become canonical key levels automatically.",
    sourceName: "StockedUp transcript",
    sourceUrl: null,
    affectedAssets: ["SPY", "SPX"],
    confidence: null,
  },
  {
    id: "stockedup-creator-ad-line",
    status: "CREATOR_ONLY",
    title: "Advance–decline line below 200DMA",
    detail:
      "The transcript says the S&P 500 advance–decline line fell below its 200-day average for the first time since November 2023. The desk has not independently reproduced that exact series/threshold yet.",
    sourceName: "StockedUp transcript",
    sourceUrl: null,
    affectedAssets: ["SPX", "RSP"],
    confidence: null,
  },
  {
    id: "stockedup-creator-30y-streak",
    status: "CREATOR_ONLY",
    title: "30Y above 5% for 79 straight days",
    detail:
      "The 30Y 5.47% level is verified; the exact 79-session streak count remains unverified and is excluded from canonical reasoning.",
    sourceName: "StockedUp transcript",
    sourceUrl: null,
    affectedAssets: ["US30Y", "SPX", "NDX"],
    confidence: null,
  },
  {
    id: "stockedup-creator-dell-short",
    status: "CREATOR_ONLY",
    title: "DELL downside setup",
    detail:
      "The bearish DELL call is a creator technical/valuation interpretation. It stays a watch item unless independent evidence and current tape support the setup.",
    sourceName: "StockedUp transcript",
    sourceUrl: null,
    affectedAssets: ["DELL"],
    confidence: null,
  },
  {
    id: "stockedup-creator-ccc-flow",
    status: "CREATOR_ONLY",
    title: "CCC unusual-options flow",
    detail:
      "The claimed roughly $614k December 2026 $7.50 call trade has not been independently verified, so it is not promoted into Stock Radar as observed institutional flow.",
    sourceName: "StockedUp transcript",
    sourceUrl: null,
    affectedAssets: ["CCC"],
    confidence: null,
  },
];

export async function getStockedUpEvidenceBrief(): Promise<StockedUpEvidenceBriefV1> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("intelligence_evidence")
    .select(
      "external_evidence_id,claim_text,available_at,affected_assets,confidence,provenance_urls,source:intelligence_evidence_sources(source_name,source_url)",
    )
    .like("external_evidence_id", "verified-macro:stockedup-%")
    .order("available_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load StockedUp verification Evidence: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as EvidenceRow[];
  const verified = rows.map((row): StockedUpEvidenceItem => {
    const externalId = row.external_evidence_id ?? "verified-macro:stockedup-unknown";
    const source = sourceFor(row);
    const numericConfidence = Number(row.confidence);
    return {
      id: externalId,
      status: "VERIFIED",
      title: titleFor(externalId),
      detail: row.claim_text,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      affectedAssets: row.affected_assets ?? [],
      confidence: Number.isFinite(numericConfidence) ? numericConfidence : null,
    };
  });

  const asOf = rows
    .map((row) => row.available_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? new Date().toISOString();

  return {
    contractVersion: STOCKEDUP_EVIDENCE_BRIEF_V1,
    reportLabel: "StockedUp verification · 24 Sep 2026",
    asOf,
    summary:
      "Creator claims are split into canonical facts, partially verified context and creator-only setups. Only VERIFIED items may directly strengthen Live's canonical market interpretation.",
    verified,
    partial: PARTIAL,
    creatorOnly: CREATOR_ONLY,
  };
}
