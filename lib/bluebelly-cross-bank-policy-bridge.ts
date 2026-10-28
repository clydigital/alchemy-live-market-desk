import type { NewsBriefV1 } from "./market-brief-news.ts";
import type { PresenterCalendar, PresenterCalendarEvent } from "./presenter-calendar.ts";

/** A read-only editorial question; never a price-reaction or canonical Story verdict. */
type Bank = { id: string; name: string; domain: string };
const BANKS: readonly Bank[] = [
  { id: "BOC", name: "Bank of Canada", domain: "bankofcanada.ca" },
  { id: "RBNZ", name: "RBNZ", domain: "rbnz.govt.nz" },
  { id: "RBA", name: "RBA", domain: "rba.gov.au" },
  { id: "BOE", name: "Bank of England", domain: "bankofengland.co.uk" },
  { id: "ECB", name: "ECB", domain: "ecb.europa.eu" },
  { id: "BOJ", name: "Bank of Japan", domain: "boj.or.jp" },
  { id: "FED", name: "Federal Reserve", domain: "federalreserve.gov" },
];

type PolicyAction = "raised" | "held";
type Observation = { bank: Bank; action: PolicyAction; news: NewsBriefV1; clock: number; energyInflationSupported: boolean };
export type CrossBankPolicyBridge = {
  question: string;
  explanation: string;
  nextTest: string;
  nextEvent: PresenterCalendarEvent;
  sharedEnergyStatus: "SOURCE_SUMMARIES" | "UNVERIFIED";
  sources: Array<{ bank: string; action: PolicyAction; url: string; occurredAt: string }>;
};

function bankFromUrl(value: string): Bank | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return BANKS.find(bank => url.hostname === bank.domain || url.hostname.endsWith("." + bank.domain)) ?? null;
  } catch {
    return null;
  }
}

function policyAction(headline: string): PolicyAction | null {
  // Require a decision in the release headline; never parse expectations from
  // a secondary story or extrapolate an announced future policy path.
  if (/\b(?:holds?|held|keeps? rates? (?:steady|unchanged)|leaves? (?:the )?(?:policy )?rates? unchanged|unchanged)\b/i.test(headline)) return "held";
  if (/\b(?:raises?|raised|hikes?|hiked|increases?|increased) (?:the )?(?:key |policy |interest )?(?:rate|rates|ocr|cash rate)\b/i.test(headline)) return "raised";
  return null;
}

function observedPolicy(news: NewsBriefV1, nowMs: number): Observation | null {
  if (news.verification !== "SOURCE_VERIFIED" || !["official", "primary"].includes(news.sourceKind.toLowerCase())) return null;
  const bank = bankFromUrl(news.sourceUrl);
  const clock = Date.parse(news.occurredAt), observed = Date.parse(news.observedAt);
  if (!bank || !Number.isFinite(clock) || !Number.isFinite(observed)) return null;
  if (clock > nowMs || observed > nowMs || observed < clock || nowMs - clock > 36 * 3_600_000) return null;
  const action = policyAction(news.headline);
  if (!action) return null;
  // The original-press projection currently contains a generic summary.
  // Its verified headline proves the action, NOT the full policy rationale.
  const message = news.headline + " " + news.summary;
  const energyInflationSupported =
    /\b(?:oil|energy|fuel|diesel|gasoline|crude)\b/i.test(message) &&
    /\b(?:inflation|cpi|consumer prices|price pressures?)\b/i.test(message);
  return { bank, action, news, clock, energyInflationSupported };
}

function nextPolicyDecision(calendar: PresenterCalendar, nowMs: number, usedBankIds: ReadonlySet<string>): PresenterCalendarEvent | null {
  const eligible = calendar.events.filter(event => {
    if (event.kind !== "economic" || event.status !== "scheduled" ||
        event.verificationState !== "official" || !event.scheduledAt) return false;
    const sourceBank = bankFromUrl(event.sourceUrl);
    if (!sourceBank || usedBankIds.has(sourceBank.id)) return false;
    const time = Date.parse(event.scheduledAt);
    if (!Number.isFinite(time) || time <= nowMs || time - nowMs > 12 * 3_600_000) return false;
    return /\b(?:fomc|federal reserve|reserve bank|central bank|bank of canada|bank of england|bank of japan|ecb|rbnz|rba|policy decision|policy rate|official cash rate)\b/i.test(event.title);
  }).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  return eligible[0] ?? null;
}

export function selectCrossBankPolicyBridge(
  news: readonly NewsBriefV1[], calendar: PresenterCalendar, now: Date,
): CrossBankPolicyBridge | null {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return null;
  const byBank = new Map<string, Observation>();
  for (const item of news) {
    const policy = observedPolicy(item, nowMs);
    if (policy && (!byBank.has(policy.bank.id) || policy.clock > byBank.get(policy.bank.id)!.clock)) {
      byBank.set(policy.bank.id, policy);
    }
  }
  const latest = [...byBank.values()].sort((a, b) => b.clock - a.clock);
  const raised = latest.find(item => item.action === "raised");
  const held = latest.find(item => item.action === "held" && item.bank.id !== raised?.bank.id);
  if (!raised || !held) return null;
  const nextEvent = nextPolicyDecision(calendar, nowMs, new Set([raised.bank.id, held.bank.id]));
  if (!nextEvent) return null;
  const commonDriverSupported = raised.energyInflationSupported && held.energyInflationSupported;
  return {
    sharedEnergyStatus: commonDriverSupported ? "SOURCE_SUMMARIES" : "UNVERIFIED",
    question: commonDriverSupported
      ? "Why did " + raised.bank.name + " raise rates while " + held.bank.name + " held despite energy-related inflation?"
      : "Why did " + raised.bank.name + " raise rates while " + held.bank.name + " held? Was energy inflation a shared constraint?",
    explanation: commonDriverSupported
      ? "Both source-qualified summaries mention energy-related inflation, but the reasons for different policy timing still need the banks' full rationale and domestic labour/demand evidence."
      : "The separately verified announcements establish different policy actions, NOT a shared oil-inflation cause. Check both original statements for energy prices, employment, demand and inflation persistence before asserting a common driver.",
    nextTest: "Ahead of " + nextEvent.title + ", compare its guidance with contemporaneous expectations, then verify the relevant two-year yields and currencies with time-matched observations. No third-bank outcome or market reaction is established here.",
    nextEvent,
    sources: [
      { bank: raised.bank.name, action: raised.action, url: raised.news.sourceUrl, occurredAt: raised.news.occurredAt },
      { bank: held.bank.name, action: held.action, url: held.news.sourceUrl, occurredAt: held.news.occurredAt },
    ],
  };
}
