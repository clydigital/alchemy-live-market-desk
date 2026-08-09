import type { CaseMonitorBoard, CaseMonitorMetric } from "@/lib/case-monitors";
import type { BreadthSnapshot, CrackSeries, MarketData, MarketSeries, PricePoint } from "@/lib/market";

const WPSR_TABLE2 = "https://ir.eia.gov/wpsr/table2.csv";
const WPSR_TABLE4 = "https://ir.eia.gov/wpsr/table4.csv";
const MOF_WEEKLY = "https://www.mof.go.jp/english/policy/international_policy/reference/itn_transactions_in_securities/index.htm";

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(value);
      value = "";
    } else value += char;
  }
  fields.push(value);
  return fields;
}

async function fetchCsv(url: string) {
  try {
    const response = await fetch(url, {
      headers: { accept: "text/csv,*/*", "user-agent": "Mozilla/5.0 (Alchemy Live Desk)" },
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return [] as string[][];
    const bytes = await response.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("�")) {
      try { text = new TextDecoder("windows-1252").decode(bytes); } catch { /* keep utf-8 */ }
    }
    return text.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  } catch {
    return [] as string[][];
  }
}

function metric(input: Partial<CaseMonitorMetric> & Pick<CaseMonitorMetric, "id" | "label" | "current" | "question" | "interpretation" | "confirmationCondition" | "invalidationCondition">): CaseMonitorMetric {
  return {
    kind: "market",
    state: "unresolved",
    previous: null,
    delta: null,
    asOf: null,
    cadence: "Daily",
    sourceName: "Alchemy official-data monitor",
    sourceUrl: null,
    provenance: "Direct or derived official market data",
    ...input,
  };
}

function pointDate(point: PricePoint | undefined) {
  return point ? new Date(point.time * 1000).toISOString() : null;
}

function mean(points: PricePoint[], length = 21) {
  const values = points.slice(-length).map((point) => point.close).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function priorValue(points: PricePoint[], sessions = 5) {
  return points.length > sessions ? points.at(-(sessions + 1))?.close ?? null : null;
}

function pct(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current / previous) - 1) * 100;
}

function formatMove(value: number | null) {
  return value == null ? null : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function crackMetric(crack: CrackSeries, id: string, label: string): CaseMonitorMetric {
  const avg = mean(crack.points, 21);
  const last = crack.last;
  const previous = priorValue(crack.points, 5);
  return metric({
    id,
    label,
    kind: "market",
    state: last == null || avg == null ? "coverage_gap" : last >= avg ? "confirming" : "contradicting",
    current: last == null ? null : `$${last.toFixed(2)}/bbl proxy`,
    previous: previous == null ? null : `$${previous.toFixed(2)}/bbl five sessions ago`,
    delta: formatMove(pct(last, previous)),
    asOf: pointDate(crack.points.at(-1)),
    cadence: "EIA daily spot prices",
    sourceName: crack.sourceName,
    sourceUrl: crack.sourceUrl,
    question: "Are refined-product margins still elevated enough to keep product tightness alive even if crude softens?",
    interpretation: last == null || avg == null ? "The crack proxy is temporarily unavailable." : `${label} is ${last >= avg ? "above" : "below"} its 21-session mean of $${avg.toFixed(2)}/bbl.`,
    confirmationCondition: "Crack proxy remains above its recent mean while crude is soft or falling.",
    invalidationCondition: "Crack proxy compresses below its recent mean alongside crude and physical normalisation.",
    provenance: crack.formula,
  });
}

function seriesMetric(series: MarketSeries, input: { id: string; label?: string; question: string; confirmation: string; invalidation: string; state?: CaseMonitorMetric["state"]; interpretation?: string }): CaseMonitorMetric {
  const previous = priorValue(series.points, 5);
  return metric({
    id: input.id,
    label: input.label || series.label,
    kind: "market",
    state: series.last == null ? "coverage_gap" : input.state || "unresolved",
    current: series.last == null ? null : `${series.last.toFixed(Math.abs(series.last) >= 100 ? 2 : 3)}${series.symbol.startsWith("^") && /yield/i.test(series.label) ? "%" : ""}`,
    previous: previous == null ? null : `${previous.toFixed(Math.abs(previous) >= 100 ? 2 : 3)} five sessions ago`,
    delta: formatMove(pct(series.last, previous)),
    asOf: pointDate(series.points.at(-1)),
    cadence: "Daily market close",
    sourceName: series.sourceName,
    sourceUrl: series.sourceUrl,
    question: input.question,
    interpretation: input.interpretation || `${series.label} is ${formatMove(series.change5d) || "unchanged"} over five sessions and ${formatMove(series.change21d) || "unchanged"} over 21 sessions.`,
    confirmationCondition: input.confirmation,
    invalidationCondition: input.invalidation,
    provenance: "Official market-history series",
  });
}

function breadthMetric(breadth: BreadthSnapshot, id: string, label: string): CaseMonitorMetric {
  const change = breadth.current.above50 - breadth.weekAgo.above50;
  const state: CaseMonitorMetric["state"] = breadth.current.sampleSize === 0 ? "coverage_gap" : breadth.current.above50 >= 55 && change >= 0 ? "confirming" : breadth.current.above50 < 45 && change < 0 ? "contradicting" : "unresolved";
  return metric({
    id,
    label,
    kind: "breadth",
    state,
    current: breadth.current.sampleSize ? `${breadth.current.above50}% >50D · ${breadth.current.above200}% >200D` : null,
    previous: breadth.weekAgo.sampleSize ? `${breadth.weekAgo.above50}% >50D one week ago` : null,
    delta: breadth.current.sampleSize ? `${change >= 0 ? "+" : ""}${change} pp in >50D breadth` : null,
    asOf: breadth.current.asOf,
    cadence: "Daily market close",
    sourceName: breadth.sourceName,
    sourceUrl: "https://www.nasdaq.com/market-activity",
    question: "Is participation broadening beneath the headline index?",
    interpretation: breadth.current.sampleSize ? `${breadth.current.sampleSize}/${breadth.targetSize} tracked names qualify for the breadth calculation. Participation is ${change > 0 ? "improving" : change < 0 ? "narrowing" : "unchanged"} from one week ago.` : "No qualifying breadth sample is available.",
    confirmationCondition: "A majority of the tracked universe holds above 50D and breadth improves versus one week ago.",
    invalidationCondition: "Participation falls below 45% above 50D and continues narrowing.",
    provenance: "Derived from Nasdaq official daily histories; incomplete constituents are disclosed in the sample count",
  });
}

function eiaRow(rows: string[][], pattern: RegExp) {
  return rows.find((row) => pattern.test(String(row[0] || "").trim())) || null;
}

async function wpsrMetrics(): Promise<CaseMonitorMetric[]> {
  const [table2, table4] = await Promise.all([fetchCsv(WPSR_TABLE2), fetchCsv(WPSR_TABLE4)]);
  const stockHeader = table4[0] || [];
  const currentDate = stockHeader[1] || null;
  const previousDate = stockHeader[2] || null;
  const gasoline = eiaRow(table4.slice(1), /^Total Motor Gasoline$/i);
  const distillate = eiaRow(table4.slice(1), /^Distillate Fuel Oil$/i);
  const utilisation = eiaRow(table2.slice(1), /percent utilization.*refinery|refinery.*percent utilization/i);
  const metrics: CaseMonitorMetric[] = [];

  for (const [row, id, label] of [
    [gasoline, "eia-gasoline-stocks", "U.S. gasoline inventories"],
    [distillate, "eia-distillate-stocks", "U.S. distillate inventories"],
  ] as const) {
    const current = row ? parseNumber(row[1]) : null;
    const previous = row ? parseNumber(row[2]) : null;
    const change = current != null && previous != null ? current - previous : null;
    metrics.push(metric({
      id,
      label,
      kind: "physical",
      state: current == null ? "coverage_gap" : change != null && change < 0 ? "confirming" : "unresolved",
      current: current == null ? null : `${current.toFixed(3)}m bbl`,
      previous: previous == null ? null : `${previous.toFixed(3)}m bbl${previousDate ? ` on ${previousDate}` : ""}`,
      delta: change == null ? null : `${change >= 0 ? "+" : ""}${change.toFixed(3)}m bbl w/w`,
      asOf: currentDate,
      cadence: "EIA Weekly Petroleum Status Report",
      sourceName: "U.S. Energy Information Administration",
      sourceUrl: WPSR_TABLE4,
      question: `Are ${label.toLowerCase()} tightening or rebuilding?`,
      interpretation: current == null ? "The WPSR CSV did not expose a readable row on this refresh." : change != null && change < 0 ? "Inventories fell week over week, supporting the product-tightness leg." : "Inventories did not fall week over week, so the stock leg is not confirming tighter product supply.",
      confirmationCondition: "Stocks decline or remain historically tight while crack margins stay elevated.",
      invalidationCondition: "Stocks rebuild materially while crack spreads compress.",
      provenance: "EIA WPSR Table 4 direct CSV",
    }));
  }

  const utilCurrent = utilisation ? parseNumber(utilisation[1]) : null;
  const utilPrevious = utilisation ? parseNumber(utilisation[2]) : null;
  metrics.push(metric({
    id: "eia-refinery-utilisation",
    label: "U.S. refinery utilisation",
    kind: "physical",
    state: utilCurrent == null ? "coverage_gap" : utilCurrent >= 90 ? "confirming" : utilCurrent < 85 ? "contradicting" : "unresolved",
    current: utilCurrent == null ? null : `${utilCurrent.toFixed(1)}%`,
    previous: utilPrevious == null ? null : `${utilPrevious.toFixed(1)}% prior week`,
    delta: utilCurrent != null && utilPrevious != null ? `${utilCurrent - utilPrevious >= 0 ? "+" : ""}${(utilCurrent - utilPrevious).toFixed(1)} pp w/w` : null,
    asOf: currentDate,
    cadence: "EIA Weekly Petroleum Status Report",
    sourceName: "U.S. Energy Information Administration",
    sourceUrl: WPSR_TABLE2,
    question: "Are refiners already running hard while product margins remain elevated?",
    interpretation: utilCurrent == null ? "The refinery-utilisation row was not readable from WPSR Table 2 on this refresh." : `${utilCurrent.toFixed(1)}% utilisation is ${utilCurrent >= 90 ? "high, strengthening the case that strong margins are not simply caused by refiners withholding capacity" : "not yet high enough to settle the refinery-run leg"}.`,
    confirmationCondition: "Refinery utilisation remains near or above 90% while product stocks stay tight and cracks stay elevated.",
    invalidationCondition: "Utilisation normalises lower while inventories rebuild and cracks compress.",
    provenance: "EIA WPSR Table 2 direct CSV",
  }));
  return metrics;
}

async function fetchEcbCross(currency: "AUD" | "GBP" | "JPY") {
  try {
    const start = new Date(Date.now() - 70 * 86400000).toISOString().slice(0, 10);
    const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=${start}&format=csvdata`;
    const response = await fetch(url, { headers: { accept: "text/csv", "user-agent": "Alchemy Live Desk" }, next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(7000) });
    if (!response.ok) return new Map<number, number>();
    const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
    const header = parseCsvLine(lines[0]);
    const dateIndex = header.indexOf("TIME_PERIOD");
    const valueIndex = header.indexOf("OBS_VALUE");
    const result = new Map<number, number>();
    for (const line of lines.slice(1)) {
      const fields = parseCsvLine(line);
      const value = parseNumber(fields[valueIndex]);
      const time = Date.parse(`${fields[dateIndex]}T00:00:00Z`) / 1000;
      if (value != null && Number.isFinite(time)) result.set(time, value);
    }
    return result;
  } catch {
    return new Map<number, number>();
  }
}

async function yenCrossMetrics() {
  const [aud, gbp, jpy] = await Promise.all([fetchEcbCross("AUD"), fetchEcbCross("GBP"), fetchEcbCross("JPY")]);
  const build = (base: Map<number, number>, id: string, label: string) => {
    const points = [...jpy.entries()].filter(([time]) => base.has(time)).map(([time, jpyPerEur]) => ({ time, close: jpyPerEur / base.get(time)! })).sort((a, b) => a.time - b.time);
    const current = points.at(-1)?.close ?? null;
    const previous = priorValue(points, 5);
    const move = pct(current, previous);
    return metric({
      id,
      label,
      kind: "market",
      state: current == null || move == null ? "coverage_gap" : move <= -1 ? "confirming" : move >= 1 ? "contradicting" : "unresolved",
      current: current == null ? null : current.toFixed(3),
      previous: previous == null ? null : `${previous.toFixed(3)} five sessions ago`,
      delta: formatMove(move),
      asOf: pointDate(points.at(-1)),
      cadence: "ECB daily reference rates",
      sourceName: "European Central Bank",
      sourceUrl: "https://data.ecb.europa.eu/data/datasets/EXR",
      question: `Is ${label} falling with USDJPY, confirming a broader yen-funded carry unwind?`,
      interpretation: move == null ? "The ECB cross could not be calculated on this refresh." : `${label} is ${formatMove(move)} over five ECB sessions.`,
      confirmationCondition: `${label} falls materially alongside USDJPY and other yen crosses.`,
      invalidationCondition: `${label} holds firm or rises while USDJPY weakness remains isolated.`,
      provenance: "Cross derived from ECB JPY/EUR divided by base-currency/EUR daily reference rates",
    });
  };
  return [build(aud, "audjpy-breadth", "AUDJPY"), build(gbp, "gbpjpy-breadth", "GBPJPY")];
}

function replaceGap(metrics: CaseMonitorMetric[], match: RegExp, replacements: CaseMonitorMetric[]) {
  const filtered = metrics.filter((item) => !(item.state === "coverage_gap" && match.test(item.label)));
  return [...filtered, ...replacements];
}

function updateGaps(board: CaseMonitorBoard, metrics: CaseMonitorMetric[]) {
  return { ...board, metrics, gaps: metrics.filter((item) => item.state === "coverage_gap").map((item) => item.label) };
}

export async function enrichCaseMonitorBoardsWithMarketData(boards: CaseMonitorBoard[], market: MarketData): Promise<CaseMonitorBoard[]> {
  const series = new Map(market.series.map((item) => [item.symbol, item]));
  const breadth = new Map(market.breadth.map((item) => [item.id, item]));
  const cracks = new Map(market.cracks.map((item) => [item.id, item]));
  const [wpsr, yenCrosses] = await Promise.all([wpsrMetrics(), yenCrossMetrics()]);

  return boards.map((board) => {
    let metrics = [...(board.metrics || [])];

    if (board.storySlug === "refining-crack-spread-stress") {
      const crackMetrics = [
        cracks.get("distillate") ? crackMetric(cracks.get("distillate")!, "distillate-crack", "Distillate crack proxy") : null,
        cracks.get("gasoline") ? crackMetric(cracks.get("gasoline")!, "gasoline-crack", "Gasoline crack proxy") : null,
        cracks.get("321") ? crackMetric(cracks.get("321")!, "321-crack", "3:2:1 refining crack proxy") : null,
      ].filter((item): item is CaseMonitorMetric => Boolean(item));
      metrics = replaceGap(metrics, /diesel crack|gasoline crack/i, crackMetrics);
      metrics = replaceGap(metrics, /refinery runs|product inventories/i, wpsr);
      const liveCracks = crackMetrics.filter((item) => item.state !== "coverage_gap");
      const confirmingCracks = liveCracks.filter((item) => item.state === "confirming").length;
      const productState = liveCracks.length >= 2 && confirmingCracks >= 2 ? "confirming" : liveCracks.length >= 2 && confirmingCracks === 0 ? "contradicting" : "unresolved";
      const updated = updateGaps(board, metrics);
      return {
        ...updated,
        state: board.state === "contradicting" ? board.state : productState,
        stateLabel: board.state === "contradicting" ? board.stateLabel : productState === "confirming" ? "PRODUCT STRESS CONFIRMING" : productState === "contradicting" ? "PRODUCT STRESS EASING" : "CRUDE / PRODUCT DIVERGENCE STILL OPEN",
        summary: `${board.summary} Live EIA crack proxies and WPSR refinery/inventory readings now test the product leg directly.`,
      };
    }

    if (["earnings-market-support", "market-breadth-health"].includes(board.storySlug)) {
      const rsp = series.get("RSP");
      const spy = series.get("^GSPC");
      const large = breadth.get("large-cap");
      const replacements: CaseMonitorMetric[] = [];
      if (rsp) {
        const relative = rsp.change5d != null && spy?.change5d != null ? rsp.change5d - spy.change5d : null;
        replacements.push(seriesMetric(rsp, {
          id: "rsp-equal-weight",
          label: "S&P 500 Equal Weight (RSP)",
          question: "Is the equal-weight index participating rather than the headline index being carried by a few names?",
          confirmation: "RSP rises and its five-day return matches or beats the cap-weighted S&P 500 proxy.",
          invalidation: "RSP materially lags the cap-weighted S&P 500 while headline indices rise.",
          state: relative == null ? "unresolved" : relative >= 0 ? "confirming" : relative <= -1 ? "contradicting" : "unresolved",
          interpretation: relative == null ? "RSP is live, but the relative five-day spread could not be calculated." : `RSP's five-day return is ${relative >= 0 ? "+" : ""}${relative.toFixed(2)} pp versus the cap-weighted S&P 500 proxy.`,
        }));
      }
      if (large) replacements.push(breadthMetric(large, "large-cap-breadth", "US large-cap breadth"));
      metrics = replaceGap(metrics, /equal.weight|% above 50d|% above 200d|advance.decline breadth/i, replacements);
      const updated = updateGaps(board, metrics);
      const direct = replacements.filter((item) => item.state !== "coverage_gap");
      const confirms = direct.filter((item) => item.state === "confirming").length;
      const contradicts = direct.filter((item) => item.state === "contradicting").length;
      return {
        ...updated,
        state: confirms >= 2 ? "confirming" : contradicts >= 1 ? "contradicting" : "unresolved",
        stateLabel: confirms >= 2 ? "BREADTH CONFIRMING" : contradicts >= 1 ? "BREADTH DIVERGENCE ACTIVE" : "BREADTH MIXED",
        summary: `${board.summary} Equal-weight performance and constituent trend participation are now direct monitors rather than inferred from SPY/QQQ.`,
      };
    }

    if (board.storySlug === "fed-long-end-stress") {
      const thirty = series.get("^TYX");
      if (thirty) metrics = replaceGap(metrics, /US 30Y/i, [seriesMetric(thirty, {
        id: "us30y-official",
        label: "US 30-year Treasury yield",
        question: "Is stress being led by the long end rather than only by near-term Fed repricing?",
        confirmation: "30Y yield rises while the move exceeds or persists beyond front-end repricing.",
        invalidation: "30Y yield falls back as inflation/term-premium stress fades.",
      })]);
      return updateGaps(board, metrics);
    }

    if (board.storySlug === "yen-carry-unwind") {
      metrics = replaceGap(metrics, /AUDJPY|GBPJPY/i, yenCrosses);
      metrics.push(metric({
        id: "japan-securities-flow-source",
        label: "Japan resident foreign-security flows",
        kind: "flow",
        state: "coverage_gap",
        current: null,
        cadence: "Weekly, normally 08:50 JST on scheduled release days",
        sourceName: "Japan Ministry of Finance",
        sourceUrl: MOF_WEEKLY,
        question: "Are Japanese residents actually repatriating or reducing foreign securities exposure?",
        interpretation: "The official MoF weekly source is identified and scheduled, but the current parser is not yet safely normalising its CSV/PDF table. Keep this as an explicit gap until the values are machine-verified.",
        confirmationCondition: "Resident net purchases of foreign securities weaken materially or turn to net sales during yen appreciation.",
        invalidationCondition: "Foreign-security accumulation continues despite yen strength.",
        provenance: "Official Japan MoF International Transactions in Securities source; parser intentionally withheld until table normalization is verified",
      }));
      const updated = updateGaps(board, metrics.filter((item, index, self) => self.findIndex((other) => other.id === item.id) === index));
      const crosses = yenCrosses.filter((item) => item.state !== "coverage_gap");
      const confirms = crosses.filter((item) => item.state === "confirming").length;
      return {
        ...updated,
        state: confirms === 2 ? "confirming" : board.state,
        stateLabel: confirms === 2 ? "YEN-CROSS UNWIND BROADENING" : board.stateLabel,
        summary: `${board.summary} AUDJPY and GBPJPY are now derived from official ECB reference rates; MoF resident flow data remains an explicit source gap until parser validation is complete.`,
      };
    }

    if (["china-ai-pressure", "ai-capex-cash-conversion"].includes(board.storySlug)) {
      const ai = breadth.get("ai-basket");
      if (ai) metrics.push(breadthMetric(ai, "ai-basket-breadth", "AI infrastructure breadth"));
      return updateGaps(board, metrics);
    }

    if (board.storySlug === "mag7-guidance-dispersion") {
      const mag7 = breadth.get("mag7");
      if (mag7) metrics.push(breadthMetric(mag7, "mag7-breadth", "Magnificent Seven breadth"));
      return updateGaps(board, metrics);
    }

    return updateGaps(board, metrics);
  });
}
