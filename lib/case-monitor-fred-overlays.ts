import type { CaseMonitorBoard, CaseMonitorMetric } from "@/lib/case-monitors";

type FredPoint = { date: string; value: number };

type FredSpec = {
  id: string;
  seriesId: string;
  label: string;
  frequency: "daily" | "monthly" | "quarterly";
  question: string;
  confirmation: string;
  invalidation: string;
  sourceNote: string;
};

const FRED_GRAPH = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=";

const SPECS: Record<string, FredSpec[]> = {
  "productivity-labor-share": [
    {
      id: "fred-productivity",
      seriesId: "OPHNFB",
      label: "Nonfarm business labour productivity",
      frequency: "quarterly",
      question: "Is output per hour rising fast enough to support margins without relying on weaker labour income?",
      confirmation: "Productivity growth stays positive while unit labour cost growth slows and household demand holds.",
      invalidation: "Productivity stalls or reverses while labour costs and household demand deteriorate together.",
      sourceNote: "BLS nonfarm business productivity series distributed through FRED",
    },
    {
      id: "fred-unit-labour-cost",
      seriesId: "ULCNFB",
      label: "Nonfarm business unit labour costs",
      frequency: "quarterly",
      question: "Are labour costs per unit of output easing relative to productivity?",
      confirmation: "Unit labour cost growth slows while productivity remains positive.",
      invalidation: "Unit labour costs reaccelerate materially or productivity weakens.",
      sourceNote: "BLS unit labour cost series distributed through FRED",
    },
    {
      id: "fred-real-weekly-earnings",
      seriesId: "LES1252881600Q",
      label: "Real median usual weekly earnings",
      frequency: "quarterly",
      question: "Are real household earnings improving rather than the productivity gain accruing only to margins?",
      confirmation: "Real median weekly earnings rise alongside productivity.",
      invalidation: "Real median weekly earnings fall while productivity rises, widening the labour-share contradiction.",
      sourceNote: "BLS Current Population Survey real earnings series distributed through FRED",
    },
    {
      id: "fred-retail-sales",
      seriesId: "RSXFS",
      label: "Advance retail sales excluding food services",
      frequency: "monthly",
      question: "Is household demand holding up as productivity and real-income conditions change?",
      confirmation: "Retail demand remains stable or improves alongside real earnings.",
      invalidation: "Retail sales weaken materially together with real earnings.",
      sourceNote: "U.S. Census Bureau retail sales series distributed through FRED",
    },
  ],
  "fed-long-end-stress": [
    {
      id: "fred-10y-breakeven",
      seriesId: "T10YIE",
      label: "10-year breakeven inflation rate",
      frequency: "daily",
      question: "Is the long-end yield move being reinforced by higher market inflation compensation?",
      confirmation: "Breakevens rise alongside the 30-year yield while front-end yields are not rising as quickly.",
      invalidation: "Breakevens fall while the 30-year yield reverses lower.",
      sourceNote: "Federal Reserve Bank of St. Louis breakeven inflation series distributed through FRED",
    },
  ],
};

function parseNumber(value: string | undefined) {
  if (!value || value === ".") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fredSeries(seriesId: string): Promise<FredPoint[]> {
  try {
    const response = await fetch(`${FRED_GRAPH}${encodeURIComponent(seriesId)}`, {
      headers: { accept: "text/csv", "user-agent": "Alchemy Live Desk" },
      next: { revalidate: 60 * 60 * 6 },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return [];
    const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
    return lines.slice(1).map((line) => {
      const [date, raw] = line.split(",");
      const value = parseNumber(raw);
      return value == null ? null : { date, value };
    }).filter((item): item is FredPoint => Boolean(item));
  } catch {
    return [];
  }
}

function signed(value: number, digits = 2, suffix = "") {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}${suffix}`;
}

function pct(current: number, previous: number) {
  return previous === 0 ? null : ((current / previous) - 1) * 100;
}

function annualisedQuarterly(current: number, previous: number) {
  if (previous <= 0 || current <= 0) return null;
  return (Math.pow(current / previous, 4) - 1) * 100;
}

function fredMetric(spec: FredSpec, points: FredPoint[]): CaseMonitorMetric {
  const current = points.at(-1) || null;
  const previous = points.at(-2) || null;
  let delta: string | null = null;
  let interpretation = "The FRED series is unavailable on this refresh.";
  let state: CaseMonitorMetric["state"] = "coverage_gap";

  if (current && previous) {
    state = "unresolved";
    if (spec.frequency === "quarterly") {
      const annualised = annualisedQuarterly(current.value, previous.value);
      delta = annualised == null ? null : `${signed(annualised, 2, "%")} q/q annualised`;
      interpretation = `${spec.label} is ${current.value.toLocaleString("en-GB", { maximumFractionDigits: 3 })}; the latest one-quarter annualised change is ${annualised == null ? "not calculable" : signed(annualised, 2, "%")}.`;
      if (spec.seriesId === "OPHNFB" && annualised != null) state = annualised > 0 ? "confirming" : "contradicting";
      if (spec.seriesId === "ULCNFB" && annualised != null) state = annualised <= 3 ? "confirming" : annualised >= 5 ? "contradicting" : "unresolved";
      if (spec.seriesId === "LES1252881600Q" && annualised != null) state = annualised >= 0 ? "confirming" : "contradicting";
    } else if (spec.frequency === "monthly") {
      const change = pct(current.value, previous.value);
      delta = change == null ? null : `${signed(change, 2, "%")} m/m`;
      interpretation = `${spec.label} is ${current.value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}; latest monthly change ${change == null ? "n/a" : signed(change, 2, "%")}.`;
      if (change != null) state = change >= 0 ? "confirming" : change <= -0.5 ? "contradicting" : "unresolved";
    } else {
      const changeBp = (current.value - previous.value) * 100;
      delta = `${signed(changeBp, 1, " bp")} vs prior observation`;
      interpretation = `${spec.label} is ${current.value.toFixed(2)}%, ${signed(changeBp, 1, " bp")} versus the prior observation.`;
      state = changeBp >= 5 ? "confirming" : changeBp <= -5 ? "contradicting" : "unresolved";
    }
  }

  return {
    id: spec.id,
    label: spec.label,
    kind: spec.frequency === "daily" ? "market" : "macro",
    state,
    current: current ? `${current.value.toLocaleString("en-GB", { maximumFractionDigits: 3 })}${spec.seriesId === "T10YIE" ? "%" : ""}` : null,
    previous: previous ? `${previous.value.toLocaleString("en-GB", { maximumFractionDigits: 3 })} on ${previous.date}` : null,
    delta,
    asOf: current?.date || null,
    cadence: spec.frequency === "daily" ? "Daily" : spec.frequency === "monthly" ? "Monthly" : "Quarterly",
    sourceName: "FRED / underlying official agency",
    sourceUrl: `https://fred.stlouisfed.org/series/${spec.seriesId}`,
    question: spec.question,
    interpretation,
    confirmationCondition: spec.confirmation,
    invalidationCondition: spec.invalidation,
    provenance: spec.sourceNote,
  };
}

function removeGap(metrics: CaseMonitorMetric[], pattern: RegExp) {
  return metrics.filter((metric) => !(metric.state === "coverage_gap" && pattern.test(metric.label)));
}

function dedupeJapanFlowGap(metrics: CaseMonitorMetric[]) {
  const base = metrics.find((metric) => metric.state === "coverage_gap" && /Japan securities flows/i.test(metric.label));
  if (!base) return metrics;
  return metrics.filter((metric) => metric.id !== "japan-securities-flow-source");
}

function normalise(board: CaseMonitorBoard, metrics: CaseMonitorMetric[]) {
  const unique = metrics.filter((metric, index, all) => all.findIndex((candidate) => candidate.id === metric.id) === index);
  return { ...board, metrics: unique, gaps: unique.filter((metric) => metric.state === "coverage_gap").map((metric) => metric.label) };
}

export async function enrichCaseMonitorBoardsWithFred(boards: CaseMonitorBoard[]) {
  const needed = [...new Set(boards.flatMap((board) => (SPECS[board.storySlug] || []).map((spec) => spec.seriesId)))];
  const fetched = await Promise.all(needed.map(async (seriesId) => [seriesId, await fredSeries(seriesId)] as const));
  const series = new Map(fetched);

  return boards.map((board) => {
    let metrics = dedupeJapanFlowGap([...board.metrics]);
    const specs = SPECS[board.storySlug] || [];
    if (!specs.length) return normalise(board, metrics);

    const additions = specs.map((spec) => fredMetric(spec, series.get(spec.seriesId) || []));
    if (board.storySlug === "productivity-labor-share") {
      metrics = removeGap(metrics, /Productivity \+ unit labour costs/i);
      metrics = removeGap(metrics, /Real earnings \+ retail sales/i);
      metrics.push(...additions);
      const productivity = additions.find((metric) => metric.id === "fred-productivity");
      const costs = additions.find((metric) => metric.id === "fred-unit-labour-cost");
      const earnings = additions.find((metric) => metric.id === "fred-real-weekly-earnings");
      const retail = additions.find((metric) => metric.id === "fred-retail-sales");
      const coreConfirm = [productivity, costs].filter((metric) => metric?.state === "confirming").length;
      const householdContradiction = [earnings, retail].filter((metric) => metric?.state === "contradicting").length;
      const updated = normalise(board, metrics);
      return {
        ...updated,
        state: coreConfirm === 2 && householdContradiction === 0 ? "confirming" : householdContradiction >= 1 ? "unresolved" : board.state,
        stateLabel: coreConfirm === 2 && householdContradiction === 0 ? "PRODUCTIVITY GAINS BROADENING" : householdContradiction >= 1 ? "PRODUCTIVITY / HOUSEHOLD SPLIT ACTIVE" : board.stateLabel,
        summary: `${board.summary} Productivity, unit labour costs, real median weekly earnings and retail demand are now read together from public official series.`,
      };
    }

    if (board.storySlug === "fed-long-end-stress") {
      metrics = removeGap(metrics, /Breakevens \+ credit spreads/i);
      metrics.push(...additions);
      metrics.push({
        id: "credit-stress-public-source",
        label: "Credit stress spread",
        kind: "coverage_gap",
        state: "coverage_gap",
        current: null,
        previous: null,
        delta: null,
        asOf: null,
        cadence: "Daily",
        sourceName: "Licensing-safe public source still required",
        sourceUrl: null,
        question: "Are corporate credit conditions deteriorating alongside the long-end yield move?",
        interpretation: "A credit-spread monitor remains intentionally unfilled until a redistribution-safe source is verified. Licensed ICE OAS data is not silently republished here.",
        confirmationCondition: "Credit stress widens while long yields and breakevens stay elevated.",
        invalidationCondition: "Credit stress remains contained as long yields and breakevens ease.",
        provenance: "Coverage gap retained to avoid redistributing a licensed spread series without permission",
      });
      return normalise(board, metrics);
    }

    metrics.push(...additions);
    return normalise(board, metrics);
  });
}
