import type { CaseMonitorBoard, CaseMonitorMetric } from "@/lib/case-monitors";
import type { EarningsCall, GuidanceItem } from "@/lib/data";

const AI_TICKERS = ["MSFT", "META", "AMZN", "GOOGL"];
const MAG7_TICKERS = ["MSFT", "META", "AMZN", "GOOGL", "AAPL"];

function metric(input: Partial<CaseMonitorMetric> & Pick<CaseMonitorMetric, "id" | "label" | "current" | "question" | "interpretation" | "confirmationCondition" | "invalidationCondition">): CaseMonitorMetric {
  return {
    kind: "macro",
    state: "unresolved",
    previous: null,
    delta: null,
    asOf: null,
    cadence: "Earnings cycle",
    sourceName: "Company earnings / guidance registry",
    sourceUrl: null,
    provenance: "Structured Alchemy record sourced from company results, filings or earnings calls",
    ...input,
  };
}

function moneyValues(text: string | null | undefined) {
  if (!text) return [] as number[];
  return [...text.matchAll(/\$\s?([0-9]+(?:\.[0-9]+)?)\s*(?:billion|bn|b)\b/gi)].map((match) => Number(match[1])).filter(Number.isFinite);
}

function percentValues(text: string | null | undefined) {
  if (!text) return [] as number[];
  return [...text.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*%/g)].map((match) => Number(match[1])).filter(Number.isFinite);
}

function callFor(calls: EarningsCall[], ticker: string) {
  return calls.filter((call) => call.ticker === ticker).sort((a, b) => Date.parse(b.call_date || "") - Date.parse(a.call_date || ""))[0] || null;
}

function guidanceFor(items: GuidanceItem[], ticker: string) {
  return items.filter((item) => item.ticker === ticker).sort((a, b) => Date.parse(b.published_at || "") - Date.parse(a.published_at || ""))[0] || null;
}

function sourceFor(guidance: GuidanceItem | null) {
  return guidance?.source_url || null;
}

function fcfDirection(call: EarningsCall | null, guidance: GuidanceItem | null) {
  const text = `${call?.summary || ""} ${call?.prior_quarter_change || ""} ${guidance?.current_view || ""} ${guidance?.prior_view || ""}`;
  if (/free cash flow (?:fell|dropped)|FCF fell|outflow/i.test(text)) return "down" as const;
  if (/free cash flow (?:rose|increased)|FCF rose/i.test(text)) return "up" as const;
  return "unknown" as const;
}

function companyAiMetric(calls: EarningsCall[], guidanceItems: GuidanceItem[], ticker: string) {
  const call = callFor(calls, ticker);
  const guidance = guidanceFor(guidanceItems, ticker);
  const capexText = call?.capex || guidance?.current_view || null;
  const capex = moneyValues(capexText);
  const fcf = fcfDirection(call, guidance);
  const current = [
    capex.length ? `Capex ${capex.map((value) => `$${value}bn`).join(" / ")}` : "Capex figure not normalised",
    fcf === "up" ? "FCF improving" : fcf === "down" ? "FCF deteriorating / outflow" : "FCF direction unresolved",
  ].join(" · ");
  const state: CaseMonitorMetric["state"] = fcf === "up" ? "confirming" : fcf === "down" ? "contradicting" : capex.length ? "unresolved" : "coverage_gap";
  const prior = call?.prior_quarter_change || guidance?.prior_view || null;
  return metric({
    id: `ai-cash-${ticker.toLowerCase()}`,
    label: `${ticker} AI capex vs cash conversion`,
    kind: "macro",
    state,
    current: capex.length || fcf !== "unknown" ? current : null,
    previous: prior,
    asOf: call?.call_date || guidance?.published_at || null,
    sourceName: call ? `${call.company_name} earnings call` : `${guidance?.entity || ticker} guidance`,
    sourceUrl: sourceFor(guidance),
    question: `Is ${ticker} converting the AI spending step-up into stronger cash generation or guidance?`,
    interpretation: call?.prior_quarter_change || guidance?.market_interpretation || call?.summary || "No current cash-conversion interpretation is stored.",
    confirmationCondition: "Cash generation and demand improve fast enough to absorb the higher capital programme.",
    invalidationCondition: "Capex rises while free cash flow, margins or forward guidance deteriorate materially.",
    provenance: "Latest structured earnings-call and guidance records in the Live Desk",
  });
}

function guidanceMetric(calls: EarningsCall[], guidanceItems: GuidanceItem[], ticker: string) {
  const call = callFor(calls, ticker);
  const guidance = guidanceFor(guidanceItems, ticker);
  const currentText = call?.guidance || guidance?.current_view || null;
  const priorText = call?.prior_quarter_change || guidance?.prior_view || null;
  const capex = moneyValues(call?.capex || guidance?.current_view || "");
  const percentages = percentValues(currentText);
  const fcf = fcfDirection(call, guidance);
  const currentParts = [
    percentages.length ? `Guide ${percentages.slice(0, 3).map((value) => `${value}%`).join(" / ")}` : null,
    capex.length ? `Capex ${capex.slice(0, 3).map((value) => `$${value}bn`).join(" / ")}` : null,
    fcf === "up" ? "FCF improving" : fcf === "down" ? "FCF weakening" : null,
  ].filter(Boolean);
  const state: CaseMonitorMetric["state"] = !currentText && !capex.length ? "coverage_gap" : fcf === "down" ? "contradicting" : fcf === "up" ? "confirming" : "unresolved";
  return metric({
    id: `mag7-dispersion-${ticker.toLowerCase()}`,
    label: `${ticker} guidance / capital burden`,
    kind: "macro",
    state,
    current: currentParts.length ? currentParts.join(" · ") : currentText,
    previous: priorText,
    asOf: call?.call_date || guidance?.published_at || null,
    sourceName: call ? `${call.company_name} earnings call` : `${guidance?.entity || ticker} guidance`,
    sourceUrl: sourceFor(guidance),
    question: `Is ${ticker}'s forward guidance improving faster than its capital burden?`,
    interpretation: guidance?.market_interpretation || call?.summary || "The current guidance record needs a new earnings update.",
    confirmationCondition: "Forward growth, margins or cash conversion improve faster than capex/depreciation burden.",
    invalidationCondition: "Capex rises while guidance, margins or cash conversion weaken.",
    provenance: "Latest structured earnings-call and guidance records in the Live Desk",
  });
}

function removeGap(metrics: CaseMonitorMetric[], pattern: RegExp) {
  return metrics.filter((item) => !(item.state === "coverage_gap" && pattern.test(item.label)));
}

function normalise(board: CaseMonitorBoard, metrics: CaseMonitorMetric[]) {
  const unique = metrics.filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
  return { ...board, metrics: unique, gaps: unique.filter((item) => item.state === "coverage_gap").map((item) => item.label) };
}

export function enrichCaseMonitorBoardsWithCompanyData(boards: CaseMonitorBoard[], calls: EarningsCall[], guidanceItems: GuidanceItem[]) {
  return boards.map((board) => {
    let metrics = [...board.metrics];

    if (board.storySlug === "ai-capex-cash-conversion") {
      const additions = AI_TICKERS.map((ticker) => companyAiMetric(calls, guidanceItems, ticker));
      const live = additions.filter((item) => item.state !== "coverage_gap");
      if (live.length >= 2) metrics = removeGap(metrics, /AI capex vs free cash flow/i);
      metrics.push(...additions);
      const confirms = live.filter((item) => item.state === "confirming").length;
      const contradicts = live.filter((item) => item.state === "contradicting").length;
      const updated = normalise(board, metrics);
      return {
        ...updated,
        state: contradicts >= 2 ? "contradicting" : confirms >= 2 ? "confirming" : "unresolved",
        stateLabel: contradicts >= 2 ? "AI CASH CONVERSION UNDER PRESSURE" : confirms >= 2 ? "AI CASH CONVERSION CONFIRMING" : "AI CAPEX / CASH CONVERSION MIXED",
        summary: `${board.summary} Latest earnings records now compare the capital step-up with cash-conversion direction across the major AI spenders.`,
      };
    }

    if (board.storySlug === "mag7-guidance-dispersion") {
      const additions = MAG7_TICKERS.map((ticker) => guidanceMetric(calls, guidanceItems, ticker));
      const live = additions.filter((item) => item.state !== "coverage_gap");
      if (live.length >= 3) metrics = removeGap(metrics, /Guidance \/ capex \/ FCF dispersion/i);
      metrics.push(...additions);
      const confirms = live.filter((item) => item.state === "confirming").length;
      const contradicts = live.filter((item) => item.state === "contradicting").length;
      const updated = normalise(board, metrics);
      return {
        ...updated,
        state: confirms > contradicts && confirms >= 2 ? "confirming" : contradicts > confirms && contradicts >= 2 ? "contradicting" : "unresolved",
        stateLabel: confirms > contradicts && confirms >= 2 ? "GUIDANCE QUALITY BROADENING" : contradicts > confirms && contradicts >= 2 ? "CAPITAL BURDEN DOMINATING" : "MEGACAP DISPERSION ACTIVE",
        summary: `${board.summary} Guidance, capex and cash-conversion records are now compared company by company rather than hidden inside a single earnings narrative.`,
      };
    }

    return normalise(board, metrics);
  });
}
