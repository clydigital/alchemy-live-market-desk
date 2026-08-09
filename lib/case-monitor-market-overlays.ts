import type { CaseMonitorBoard, CaseMonitorMetric } from "@/lib/case-monitors";
import type { BreadthSnapshot, CrackSeries, MarketData, MarketSeries, PricePoint } from "@/lib/market";

const WPSR_TABLE2 = "https://ir.eia.gov/wpsr/table2.csv";
const WPSR_TABLE4 = "https://ir.eia.gov/wpsr/table4.csv";
const MOF_WEEKLY = "https://www.mof.go.jp/english/policy/international_policy/reference/itn_transactions_in_securities/index.htm";

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function csvLine(line: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { fields.push(value); value = ""; }
    else value += char;
  }
  fields.push(value);
  return fields;
}

async function csvRows(url: string) {
  try {
    const response = await fetch(url, {
      headers: { accept: "text/csv,*/*", "user-agent": "Mozilla/5.0 (Alchemy Live Desk)" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return [] as string[][];
    const text = new TextDecoder("utf-8").decode(await response.arrayBuffer());
    return text.split(/\r?\n/).filter(Boolean).map(csvLine);
  } catch { return [] as string[][]; }
}

function makeMetric(input: Partial<CaseMonitorMetric> & Pick<CaseMonitorMetric, "id" | "label" | "current" | "question" | "interpretation" | "confirmationCondition" | "invalidationCondition">): CaseMonitorMetric {
  return {
    kind: "market",
    state: "unresolved",
    previous: null,
    delta: null,
    asOf: null,
    cadence: "Daily",
    sourceName: "Alchemy official-data monitor",
    sourceUrl: null,
    provenance: "Direct or derived official data",
    ...input,
  };
}

function dateOf(point?: PricePoint) { return point ? new Date(point.time * 1000).toISOString() : null; }
function prior(points: PricePoint[], sessions = 5) { return points.length > sessions ? points.at(-(sessions + 1))?.close ?? null : null; }
function move(current: number | null, previous: number | null) { return current == null || previous == null || previous === 0 ? null : ((current / previous) - 1) * 100; }
function moveText(value: number | null) { return value == null ? null : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`; }
function mean(points: PricePoint[], length = 21) {
  const values = points.slice(-length).map((point) => point.close);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function crackMetric(crack: CrackSeries, id: string, label: string) {
  const recentMean = mean(crack.points);
  const previous = prior(crack.points);
  return makeMetric({
    id, label, kind: "spread",
    state: crack.last == null || recentMean == null ? "coverage_gap" : crack.last >= recentMean ? "confirming" : "contradicting",
    current: crack.last == null ? null : `$${crack.last.toFixed(2)}/bbl proxy`,
    previous: previous == null ? null : `$${previous.toFixed(2)}/bbl five sessions ago`,
    delta: moveText(move(crack.last, previous)),
    asOf: dateOf(crack.points.at(-1)), cadence: "EIA daily spot prices",
    sourceName: crack.sourceName, sourceUrl: crack.sourceUrl,
    question: "Are refined-product margins staying elevated while crude softens?",
    interpretation: crack.last == null || recentMean == null ? "The crack proxy is unavailable." : `${label} is ${crack.last >= recentMean ? "above" : "below"} its 21-session mean of $${recentMean.toFixed(2)}/bbl.`,
    confirmationCondition: "Crack proxy remains above its recent mean while crude stays soft.",
    invalidationCondition: "Crack proxy compresses below its recent mean alongside crude and physical normalisation.",
    provenance: crack.formula,
  });
}

function marketMetric(series: MarketSeries, options: { id: string; label?: string; question: string; confirmation: string; invalidation: string; state?: CaseMonitorMetric["state"]; interpretation?: string }) {
  const previous = prior(series.points);
  return makeMetric({
    id: options.id, label: options.label || series.label, kind: "market",
    state: series.last == null ? "coverage_gap" : options.state || "unresolved",
    current: series.last == null ? null : `${series.last.toFixed(Math.abs(series.last) >= 100 ? 2 : 3)}${/yield/i.test(series.label) ? "%" : ""}`,
    previous: previous == null ? null : `${previous.toFixed(Math.abs(previous) >= 100 ? 2 : 3)} five sessions ago`,
    delta: moveText(move(series.last, previous)), asOf: dateOf(series.points.at(-1)), cadence: "Daily market close",
    sourceName: series.sourceName, sourceUrl: series.sourceUrl,
    question: options.question,
    interpretation: options.interpretation || `${series.label}: ${moveText(series.change5d) || "n/a"} over five sessions; ${moveText(series.change21d) || "n/a"} over 21 sessions.`,
    confirmationCondition: options.confirmation, invalidationCondition: options.invalidation,
    provenance: "Official market-history series",
  });
}

function participationMetric(breadth: BreadthSnapshot, id: string, label: string) {
  const delta = breadth.current.above50 - breadth.weekAgo.above50;
  return makeMetric({
    id, label, kind: "market",
    state: !breadth.current.sampleSize ? "coverage_gap" : breadth.current.above50 >= 55 && delta >= 0 ? "confirming" : breadth.current.above50 < 45 && delta < 0 ? "contradicting" : "unresolved",
    current: !breadth.current.sampleSize ? null : `${breadth.current.above50}% >50D · ${breadth.current.above200}% >200D`,
    previous: !breadth.weekAgo.sampleSize ? null : `${breadth.weekAgo.above50}% >50D one week ago`,
    delta: !breadth.current.sampleSize ? null : `${delta >= 0 ? "+" : ""}${delta} pp in >50D breadth`,
    asOf: breadth.current.asOf, cadence: "Daily market close", sourceName: breadth.sourceName,
    sourceUrl: "https://www.nasdaq.com/market-activity",
    question: "Is participation broadening beneath the headline index?",
    interpretation: !breadth.current.sampleSize ? "No qualifying breadth sample is available." : `${breadth.current.sampleSize}/${breadth.targetSize} tracked names qualify. Participation is ${delta > 0 ? "improving" : delta < 0 ? "narrowing" : "unchanged"} from one week ago.`,
    confirmationCondition: "A majority of the tracked universe holds above 50D and participation improves.",
    invalidationCondition: "Participation falls below 45% above 50D and keeps narrowing.",
    provenance: "Derived from Nasdaq official daily histories with sample coverage disclosed",
  });
}

function findRow(rows: string[][], pattern: RegExp) { return rows.find((row) => pattern.test(String(row[0] || "").trim())) || null; }

async function wpsrMetrics() {
  const [table2, table4] = await Promise.all([csvRows(WPSR_TABLE2), csvRows(WPSR_TABLE4)]);
  const currentDate = table4[0]?.[1] || table2[0]?.[1] || null;
  const previousDate = table4[0]?.[2] || table2[0]?.[2] || null;
  const rows: Array<[string[][], RegExp, string, string]> = [
    [table4, /^Total Motor Gasoline$/i, "eia-gasoline-stocks", "U.S. gasoline inventories"],
    [table4, /^Distillate Fuel Oil$/i, "eia-distillate-stocks", "U.S. distillate inventories"],
  ];
  const metrics = rows.map(([table, pattern, id, label]) => {
    const row = findRow(table.slice(1), pattern);
    const current = row ? numberValue(row[1]) : null;
    const previous = row ? numberValue(row[2]) : null;
    const change = current != null && previous != null ? current - previous : null;
    return makeMetric({
      id, label, kind: "physical",
      state: current == null ? "coverage_gap" : change != null && change < 0 ? "confirming" : "unresolved",
      current: current == null ? null : `${current.toFixed(3)}m bbl`,
      previous: previous == null ? null : `${previous.toFixed(3)}m bbl${previousDate ? ` on ${previousDate}` : ""}`,
      delta: change == null ? null : `${change >= 0 ? "+" : ""}${change.toFixed(3)}m bbl w/w`, asOf: currentDate,
      cadence: "EIA Weekly Petroleum Status Report", sourceName: "U.S. Energy Information Administration", sourceUrl: WPSR_TABLE4,
      question: `Are ${label.toLowerCase()} tightening or rebuilding?`,
      interpretation: current == null ? "The WPSR CSV did not expose a readable row." : change != null && change < 0 ? "Stocks fell week over week, supporting the product-tightness leg." : "Stocks did not fall week over week, so this stock leg is not confirming tighter supply.",
      confirmationCondition: "Stocks decline or remain tight while crack margins stay elevated.", invalidationCondition: "Stocks rebuild materially while crack spreads compress.",
      provenance: "EIA WPSR Table 4 direct CSV",
    });
  });
  const utilRow = findRow(table2.slice(1), /percent utilization.*refinery|refinery.*percent utilization/i);
  const util = utilRow ? numberValue(utilRow[1]) : null;
  const utilPrev = utilRow ? numberValue(utilRow[2]) : null;
  metrics.push(makeMetric({
    id: "eia-refinery-utilisation", label: "U.S. refinery utilisation", kind: "physical",
    state: util == null ? "coverage_gap" : util >= 90 ? "confirming" : util < 85 ? "contradicting" : "unresolved",
    current: util == null ? null : `${util.toFixed(1)}%`, previous: utilPrev == null ? null : `${utilPrev.toFixed(1)}% prior week`,
    delta: util != null && utilPrev != null ? `${util - utilPrev >= 0 ? "+" : ""}${(util - utilPrev).toFixed(1)} pp w/w` : null, asOf: currentDate,
    cadence: "EIA Weekly Petroleum Status Report", sourceName: "U.S. Energy Information Administration", sourceUrl: WPSR_TABLE2,
    question: "Are refiners already running hard while product margins remain elevated?",
    interpretation: util == null ? "The refinery-utilisation row was not readable from WPSR Table 2." : `${util.toFixed(1)}% utilisation is ${util >= 90 ? "high, strengthening the product-tightness test" : "not high enough by itself to settle the refinery-run leg"}.`,
    confirmationCondition: "Utilisation stays near or above 90% while product stocks stay tight and cracks stay elevated.",
    invalidationCondition: "Utilisation falls while inventories rebuild and crack spreads compress.", provenance: "EIA WPSR Table 2 direct CSV",
  }));
  return metrics;
}

async function ecbCross(currency: "AUD" | "GBP" | "JPY") {
  try {
    const start = new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10);
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=${start}&format=csvdata`;
    const response = await fetch(url, { headers: { accept: "text/csv", "user-agent": "Alchemy Live Desk" }, next: { revalidate: 21600 }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return new Map<number, number>();
    const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
    const header = csvLine(lines[0]);
    const dateIndex = header.indexOf("TIME_PERIOD");
    const valueIndex = header.indexOf("OBS_VALUE");
    const result = new Map<number, number>();
    for (const line of lines.slice(1)) {
      const fields = csvLine(line);
      const value = numberValue(fields[valueIndex]);
      const time = Date.parse(`${fields[dateIndex]}T00:00:00Z`) / 1000;
      if (value != null && Number.isFinite(time)) result.set(time, value);
    }
    return result;
  } catch { return new Map<number, number>(); }
}

async function yenCrossMetrics() {
  const [aud, gbp, jpy] = await Promise.all([ecbCross("AUD"), ecbCross("GBP"), ecbCross("JPY")]);
  const build = (base: Map<number, number>, id: string, label: string) => {
    const points = [...jpy.entries()].filter(([time]) => base.has(time)).map(([time, jpyPerEur]) => ({ time, close: jpyPerEur / base.get(time)! })).sort((a, b) => a.time - b.time);
    const current = points.at(-1)?.close ?? null;
    const previous = prior(points);
    const change = move(current, previous);
    return makeMetric({
      id, label, kind: "market",
      state: current == null || change == null ? "coverage_gap" : change <= -1 ? "confirming" : change >= 1 ? "contradicting" : "unresolved",
      current: current == null ? null : current.toFixed(3), previous: previous == null ? null : `${previous.toFixed(3)} five sessions ago`,
      delta: moveText(change), asOf: dateOf(points.at(-1)), cadence: "ECB daily reference rates", sourceName: "European Central Bank",
      sourceUrl: "https://data.ecb.europa.eu/data/datasets/EXR",
      question: `Is ${label} falling with USDJPY, confirming a broader yen-funded carry unwind?`,
      interpretation: change == null ? "The ECB cross could not be calculated." : `${label} is ${moveText(change)} over five ECB sessions.`,
      confirmationCondition: `${label} falls materially alongside USDJPY and other yen crosses.`, invalidationCondition: `${label} holds firm or rises while USDJPY weakness stays isolated.`,
      provenance: "Derived from ECB JPY/EUR divided by base-currency/EUR daily reference rates",
    });
  };
  return [build(aud, "audjpy-breadth", "AUDJPY"), build(gbp, "gbpjpy-breadth", "GBPJPY")];
}

function replaceGaps(metrics: CaseMonitorMetric[], match: RegExp, replacements: CaseMonitorMetric[]) {
  return [...metrics.filter((item) => !(item.state === "coverage_gap" && match.test(item.label))), ...replacements];
}
function normalise(board: CaseMonitorBoard, metrics: CaseMonitorMetric[]) {
  const unique = metrics.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  return { ...board, metrics: unique, gaps: unique.filter((item) => item.state === "coverage_gap").map((item) => item.label) };
}

export async function enrichCaseMonitorBoardsWithMarketData(boards: CaseMonitorBoard[], market: MarketData) {
  const series = new Map(market.series.map((item) => [item.symbol, item]));
  const breadth = new Map(market.breadth.map((item) => [item.id, item]));
  const cracks = new Map(market.cracks.map((item) => [item.id, item]));
  const [wpsr, yenCrosses] = await Promise.all([wpsrMetrics(), yenCrossMetrics()]);

  return boards.map((board) => {
    let metrics = [...board.metrics];
    if (board.storySlug === "refining-crack-spread-stress") {
      const crackMetrics = [
        cracks.get("distillate") ? crackMetric(cracks.get("distillate")!, "distillate-crack", "Distillate crack proxy") : null,
        cracks.get("gasoline") ? crackMetric(cracks.get("gasoline")!, "gasoline-crack", "Gasoline crack proxy") : null,
        cracks.get("321") ? crackMetric(cracks.get("321")!, "321-crack", "3:2:1 refining crack proxy") : null,
      ].filter((item): item is CaseMonitorMetric => Boolean(item));
      metrics = replaceGaps(metrics, /diesel crack|gasoline crack/i, crackMetrics);
      metrics = replaceGaps(metrics, /refinery runs|product inventories/i, wpsr);
      const live = crackMetrics.filter((item) => item.state !== "coverage_gap");
      const confirms = live.filter((item) => item.state === "confirming").length;
      const productState: CaseMonitorMetric["state"] = live.length >= 2 && confirms >= 2 ? "confirming" : live.length >= 2 && confirms === 0 ? "contradicting" : "unresolved";
      const updated = normalise(board, metrics);
      return { ...updated, state: board.state === "contradicting" ? board.state : productState, stateLabel: board.state === "contradicting" ? board.stateLabel : productState === "confirming" ? "PRODUCT STRESS CONFIRMING" : productState === "contradicting" ? "PRODUCT STRESS EASING" : "CRUDE / PRODUCT DIVERGENCE STILL OPEN", summary: `${board.summary} EIA crack proxies and WPSR readings now test the product leg directly.` };
    }

    if (["earnings-market-support", "market-breadth-health"].includes(board.storySlug)) {
      const rsp = series.get("RSP");
      const cap = series.get("^GSPC");
      const large = breadth.get("large-cap");
      const direct: CaseMonitorMetric[] = [];
      if (rsp) {
        const relative = rsp.change5d != null && cap?.change5d != null ? rsp.change5d - cap.change5d : null;
        direct.push(marketMetric(rsp, { id: "rsp-equal-weight", label: "S&P 500 Equal Weight (RSP)", question: "Is equal-weight participation keeping pace with the headline index?", confirmation: "RSP matches or beats cap-weighted S&P 500 performance.", invalidation: "RSP materially lags while the headline index rises.", state: relative == null ? "unresolved" : relative >= 0 ? "confirming" : relative <= -1 ? "contradicting" : "unresolved", interpretation: relative == null ? "RSP is live, but the relative spread is unavailable." : `RSP's five-session return is ${relative >= 0 ? "+" : ""}${relative.toFixed(2)} pp versus the cap-weighted S&P proxy.` }));
      }
      if (large) direct.push(participationMetric(large, "large-cap-breadth", "US large-cap breadth"));
      metrics = replaceGaps(metrics, /equal.weight|% above 50d|% above 200d|advance.decline breadth/i, direct);
      const updated = normalise(board, metrics);
      const confirms = direct.filter((item) => item.state === "confirming").length;
      const contradicts = direct.filter((item) => item.state === "contradicting").length;
      return { ...updated, state: confirms >= 2 ? "confirming" : contradicts ? "contradicting" : "unresolved", stateLabel: confirms >= 2 ? "BREADTH CONFIRMING" : contradicts ? "BREADTH DIVERGENCE ACTIVE" : "BREADTH MIXED", summary: `${board.summary} Equal-weight and constituent trend participation now provide direct breadth checks.` };
    }

    if (board.storySlug === "fed-long-end-stress") {
      const thirty = series.get("^TYX");
      if (thirty) metrics = replaceGaps(metrics, /US 30Y/i, [marketMetric(thirty, { id: "us30y-official", label: "US 30-year Treasury yield", question: "Is stress being led by the long end rather than only near-term Fed repricing?", confirmation: "30Y yield rises persistently beyond front-end repricing.", invalidation: "30Y yield falls as inflation and term-premium stress fade." })]);
      return normalise(board, metrics);
    }

    if (board.storySlug === "yen-carry-unwind") {
      metrics = replaceGaps(metrics, /AUDJPY|GBPJPY/i, yenCrosses);
      const existingFlow = metrics.some((item) => item.id === "japan-securities-flow-source");
      if (!existingFlow) metrics.push(makeMetric({ id: "japan-securities-flow-source", label: "Japan resident foreign-security flows", kind: "physical", state: "coverage_gap", current: null, cadence: "Weekly official release", sourceName: "Japan Ministry of Finance", sourceUrl: MOF_WEEKLY, question: "Are Japanese residents actually repatriating or reducing foreign-security exposure?", interpretation: "The official weekly source is identified, but table normalisation is not yet machine-verified. This remains an explicit gap rather than a guessed flow reading.", confirmationCondition: "Resident foreign-security accumulation weakens materially or turns to net sales during yen appreciation.", invalidationCondition: "Foreign-security accumulation continues despite yen strength.", provenance: "Japan MoF International Transactions in Securities; parser intentionally withheld until verified" }));
      const updated = normalise(board, metrics);
      const crossConfirms = yenCrosses.filter((item) => item.state === "confirming").length;
      return { ...updated, state: crossConfirms === 2 ? "confirming" : board.state, stateLabel: crossConfirms === 2 ? "YEN-CROSS UNWIND BROADENING" : board.stateLabel, summary: `${board.summary} AUDJPY and GBPJPY are now derived from ECB reference rates; MoF resident flows remain an explicit parser gap.` };
    }

    if (["china-ai-pressure", "ai-capex-cash-conversion"].includes(board.storySlug)) {
      const ai = breadth.get("ai-basket");
      if (ai) metrics.push(participationMetric(ai, "ai-basket-breadth", "AI infrastructure breadth"));
      return normalise(board, metrics);
    }
    if (board.storySlug === "mag7-guidance-dispersion") {
      const mag7 = breadth.get("mag7");
      if (mag7) metrics.push(participationMetric(mag7, "mag7-breadth", "Magnificent Seven breadth"));
      return normalise(board, metrics);
    }
    return normalise(board, metrics);
  });
}
