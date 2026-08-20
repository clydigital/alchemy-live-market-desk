export const JAPAN_MOF_WEEKLY_URL = "https://www.mof.go.jp/policy/international_policy/reference/itn_transactions_in_securities/week.csv";
export const JAPAN_MOF_SOURCE_NAME = "Japan Ministry of Finance" as const;
export const JAPAN_MOF_SOURCE_UNIT = "JPY 100 million" as const;
export const JAPAN_MOF_CANONICAL_UNIT = "JPY bn" as const;

const MOF_NET_COLUMNS = {
  outwardEquity: 3,
  outwardLongTermDebt: 6,
  outwardShortTermDebt: 10,
  outwardTotal: 11,
  inwardEquity: 14,
  inwardLongTermDebt: 17,
  inwardShortTermDebt: 21,
  inwardTotal: 22,
} as const;

export type JapanMofWeeklyFlowRow = {
  periodLabel: string;
  inferredGregorianYear: number | null;
  outwardSignConvention: "net_purchase_positive" | "net_sale_positive" | "unknown";
  outwardEquityNetJpyBn: number | null;
  outwardLongTermDebtNetJpyBn: number | null;
  outwardShortTermDebtNetJpyBn: number | null;
  outwardTotalNetJpyBn: number | null;
  outwardEquityNetPurchaseJpyBn: number | null;
  outwardLongTermDebtNetPurchaseJpyBn: number | null;
  outwardShortTermDebtNetPurchaseJpyBn: number | null;
  outwardTotalNetPurchaseJpyBn: number | null;
  inwardEquityNetJpyBn: number | null;
  inwardLongTermDebtNetJpyBn: number | null;
  inwardShortTermDebtNetJpyBn: number | null;
  inwardTotalNetJpyBn: number | null;
};

export type JapanMofWeeklySnapshot = {
  state: "ready" | "unavailable";
  retrievedAt: string | null;
  rows: JapanMofWeeklyFlowRow[];
  latest: JapanMofWeeklyFlowRow | null;
  sourceName: typeof JAPAN_MOF_SOURCE_NAME;
  sourceUrl: typeof JAPAN_MOF_WEEKLY_URL;
  sourceUnit: typeof JAPAN_MOF_SOURCE_UNIT;
  canonicalUnit: typeof JAPAN_MOF_CANONICAL_UNIT;
  note: string | null;
};

function splitCsvLine(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

function parseMofNumber(raw: string) {
  const cleaned = raw
    .replace(/,/g, "")
    .replace(/[△▲]/g, "-")
    .replace(/[＊*]/g, "")
    .replace(/[\s\u3000]/g, "")
    .trim();
  if (!cleaned || cleaned === "-" || cleaned === "--") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function inferJapanMofGregorianYear(periodLabel: string) {
  const western = periodLabel.match(/\b((?:19|20)\d{2})\b/);
  if (western) return Number(western[1]);

  const reiwa = periodLabel.match(/令和\s*(元|\d+)\s*年/);
  if (reiwa) {
    const eraYear = reiwa[1] === "元" ? 1 : Number(reiwa[1]);
    return Number.isFinite(eraYear) && eraYear > 0 ? 2018 + eraYear : null;
  }

  const heisei = periodLabel.match(/平成\s*(元|\d+)\s*年/);
  if (heisei) {
    const eraYear = heisei[1] === "元" ? 1 : Number(heisei[1]);
    return Number.isFinite(eraYear) && eraYear > 0 ? 1988 + eraYear : null;
  }

  return null;
}

function outwardConvention(year: number | null): JapanMofWeeklyFlowRow["outwardSignConvention"] {
  if (year === null) return "unknown";
  return year >= 2014 ? "net_purchase_positive" : "net_sale_positive";
}

function normalizeOutwardNetPurchase(value: number | null, convention: JapanMofWeeklyFlowRow["outwardSignConvention"]) {
  if (value === null || convention === "unknown") return null;
  return convention === "net_purchase_positive" ? value : -value;
}

function okuYenToJpyBn(value: number | null) {
  return value === null ? null : value / 10;
}

function looksLikeDataPeriod(value: string) {
  const normalized = value.replace(/\u3000/g, " ").trim();
  if (!normalized || /(?:Period|期間|\(Note|注[:：]?)/i.test(normalized)) return false;
  return /\d/.test(normalized) && /[～〜~\-]/.test(normalized);
}

export function parseJapanMofWeeklyCsv(text: string): JapanMofWeeklyFlowRow[] {
  const rows: JapanMofWeeklyFlowRow[] = [];

  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.length < 23) continue;

    const periodLabel = cells[0].replace(/\u3000/g, " ").trim();
    if (!looksLikeDataPeriod(periodLabel)) continue;

    const sourceValues = Object.fromEntries(
      Object.entries(MOF_NET_COLUMNS).map(([key, index]) => [key, parseMofNumber(cells[index] || "")]),
    ) as Record<keyof typeof MOF_NET_COLUMNS, number | null>;

    if (Object.values(sourceValues).filter((value) => value !== null).length < 6) continue;

    const year = inferJapanMofGregorianYear(periodLabel);
    const convention = outwardConvention(year);
    const outwardEquity = okuYenToJpyBn(sourceValues.outwardEquity);
    const outwardLongTermDebt = okuYenToJpyBn(sourceValues.outwardLongTermDebt);
    const outwardShortTermDebt = okuYenToJpyBn(sourceValues.outwardShortTermDebt);
    const outwardTotal = okuYenToJpyBn(sourceValues.outwardTotal);

    rows.push({
      periodLabel,
      inferredGregorianYear: year,
      outwardSignConvention: convention,
      outwardEquityNetJpyBn: outwardEquity,
      outwardLongTermDebtNetJpyBn: outwardLongTermDebt,
      outwardShortTermDebtNetJpyBn: outwardShortTermDebt,
      outwardTotalNetJpyBn: outwardTotal,
      outwardEquityNetPurchaseJpyBn: normalizeOutwardNetPurchase(outwardEquity, convention),
      outwardLongTermDebtNetPurchaseJpyBn: normalizeOutwardNetPurchase(outwardLongTermDebt, convention),
      outwardShortTermDebtNetPurchaseJpyBn: normalizeOutwardNetPurchase(outwardShortTermDebt, convention),
      outwardTotalNetPurchaseJpyBn: normalizeOutwardNetPurchase(outwardTotal, convention),
      inwardEquityNetJpyBn: okuYenToJpyBn(sourceValues.inwardEquity),
      inwardLongTermDebtNetJpyBn: okuYenToJpyBn(sourceValues.inwardLongTermDebt),
      inwardShortTermDebtNetJpyBn: okuYenToJpyBn(sourceValues.inwardShortTermDebt),
      inwardTotalNetJpyBn: okuYenToJpyBn(sourceValues.inwardTotal),
    });
  }

  return rows;
}

function unavailable(retrievedAt: string | null, note: string): JapanMofWeeklySnapshot {
  return {
    state: "unavailable",
    retrievedAt,
    rows: [],
    latest: null,
    sourceName: JAPAN_MOF_SOURCE_NAME,
    sourceUrl: JAPAN_MOF_WEEKLY_URL,
    sourceUnit: JAPAN_MOF_SOURCE_UNIT,
    canonicalUnit: JAPAN_MOF_CANONICAL_UNIT,
    note,
  };
}

export async function fetchJapanMofWeeklyFlows(fetchImpl: typeof fetch = fetch): Promise<JapanMofWeeklySnapshot> {
  const retrievedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(JAPAN_MOF_WEEKLY_URL, {
      headers: {
        accept: "text/csv,text/plain,*/*",
        "user-agent": "Alchemy Live Desk Japan-MOF public-data adapter",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return unavailable(retrievedAt, `Japan MOF weekly CSV returned HTTP ${response.status}.`);
    }

    const bytes = await response.arrayBuffer();
    let text: string;
    try {
      text = new TextDecoder("shift_jis").decode(bytes);
    } catch {
      text = new TextDecoder("utf-8").decode(bytes);
    }
    const rows = parseJapanMofWeeklyCsv(text);
    if (!rows.length) {
      return unavailable(retrievedAt, "Japan MOF weekly CSV returned no rows matching the proven weekly table shape.");
    }

    return {
      state: "ready",
      retrievedAt,
      rows,
      latest: rows[rows.length - 1],
      sourceName: JAPAN_MOF_SOURCE_NAME,
      sourceUrl: JAPAN_MOF_WEEKLY_URL,
      sourceUnit: JAPAN_MOF_SOURCE_UNIT,
      canonicalUnit: JAPAN_MOF_CANONICAL_UNIT,
      note: "Outward net-sign semantics changed in January 2014. Raw net values are preserved; normalized outward net-purchase fields reverse pre-2014 signs only when the period year is identifiable.",
    };
  } catch (error) {
    return unavailable(
      retrievedAt,
      error instanceof Error ? `Japan MOF weekly CSV unavailable: ${error.message}` : "Japan MOF weekly CSV unavailable.",
    );
  }
}
