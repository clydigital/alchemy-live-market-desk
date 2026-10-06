import type { NewsThread, PublicStatement, Story } from "./data.ts";
import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";
import type { StoryEvent, StoryThesisVersion } from "./persistence/contracts.ts";
import { storyFramingDependsOnExpiredCatalyst } from "./story-hygiene.ts";

export const REGIME_ROUTING_CONTRACT_VERSION = "regime-routing/1" as const;

export type RegimeSlug =
  | "global-cost-of-capital"
  | "us-china-ai"
  | "energy-security-inflation"
  | "gold-reserve-diversification"
  | "equity-rally-quality";

export type RegimeNodeState =
  | "supports"
  | "contradicts"
  | "unresolved"
  | "context"
  | "interpretation_pending";

export type RegimeSubgroupDefinition = {
  key: string;
  label: string;
  accent: "blue" | "purple" | "orange" | "green" | "yellow" | "red" | "gold" | "teal";
  whyItMatters: string;
  mechanism: string;
};

export type RegimeDefinition = {
  slug: RegimeSlug;
  title: string;
  shortTitle: string;
  coreQuestion: string;
  whyItMatters: string;
  mechanism: string;
  affectedMarkets: string[];
  subgroups: RegimeSubgroupDefinition[];
};

export type RegimeRoute = {
  regime: RegimeSlug;
  subgroup: string;
  role: "core" | "supporting" | "bridge";
  score: number;
};

export type RegimeStoryMaturity = "durable" | "early" | "seed" | "episode" | "stale";

export type ProjectedStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  question: string | null;
  confidence: number;
  lifecycle: string;
  editorialVerdict: string | null;
  assets: string[];
  versionId: string | null;
  versionNumber: number | null;
  routes: RegimeRoute[];
  maturity: RegimeStoryMaturity;
  contributesToState: boolean;
  maturityReason: string;
  hybridHref: string;
};

export type RegimeContributionNode = {
  id: string;
  title: string;
  detail: string;
  timestamp: string | null;
  state: RegimeNodeState;
  sourceKind: "story_event" | "news" | "statement" | "dossier_motion";
  verification: string | null;
  storyId: string | null;
  storySlug: string | null;
  href: string | null;
  hybridHref: string | null;
};

export type RegimeTelemetryItem = {
  key: string;
  label: string;
  state: string;
  detail: string;
  asOf: string | null;
  source: string;
};

export type ProjectedRegimeSubgroup = RegimeSubgroupDefinition & {
  state: string;
  stateKind: "system1" | "interpreted" | "unresolved";
  stories: ProjectedStory[];
  durableStories: ProjectedStory[];
  contextStories: ProjectedStory[];
  nodes: RegimeContributionNode[];
  telemetry: RegimeTelemetryItem[];
  latestAt: string | null;
};

export type ProjectedRegime = Omit<RegimeDefinition, "subgroups"> & {
  state: string;
  stateKind: "system1" | "interpreted" | "unresolved";
  confidence: string;
  asOf: string | null;
  stories: ProjectedStory[];
  durableStories: ProjectedStory[];
  contextStories: ProjectedStory[];
  latestNode: RegimeContributionNode | null;
  /**
   * Read-only Dossier System-2 context. Optional for historical snapshots and
   * legacy test fixtures; current projections always emit an array.
   */
  dossierContext?: RegimeContributionNode[];
  subgroups: ProjectedRegimeSubgroup[];
  hybridHref: string;
};

export const REGIME_DEFINITIONS: RegimeDefinition[] = [
  {
    slug: "global-cost-of-capital",
    title: "Sovereign Funding & Global Cost of Capital",
    shortTitle: "US Rate Regime",
    coreQuestion: "Can the US and global system absorb sovereign issuance and private capital demand without long yields, credit spreads and refinancing stress becoming self-reinforcing?",
    whyItMatters: "Long-term yields and funding conditions transmit into mortgages, CRE, private credit, AI financing, equity valuations, currencies and the government's own interest burden.",
    mechanism: "Treasury / fiscal supply + inflation / oil + foreign allocation + private duration demand → term premium / long yields → mortgages + credit + project finance → refinancing / forced selling → earnings and policy response.",
    affectedMarkets: ["US02Y", "US05Y", "US10Y", "US20Y", "US30Y", "DXY", "USDJPY", "JGB10Y", "JGB30Y", "BUND10Y", "OAT10Y", "GILT30Y", "XAUUSD", "IG", "HY", "CMBS", "KRE", "Housing"],
    subgroups: [
      { key: "fed-front-end", label: "Fed / Front End", accent: "blue", whyItMatters: "The front end shows how markets price the near-term policy path.", mechanism: "Macro surprise → Fed path → 2Y / policy pricing → USD and rate-sensitive assets." },
      { key: "treasury-fiscal", label: "Treasury / Fiscal", accent: "purple", whyItMatters: "Borrowing needs matter through the clearing yield required to attract marginal domestic and foreign buyers.", mechanism: "Deficits / financing mix → Treasury supply → marginal-buyer absorption → term premium / funding pressure." },
      { key: "long-end", label: "Long End / Term Premium", accent: "orange", whyItMatters: "The 10Y/30Y can stay restrictive even when the expected Fed path turns less hawkish.", mechanism: "Inflation + supply + real yields + term premium → 10Y/30Y → economy-wide cost of capital." },
      { key: "global-rates", label: "Global Sovereign / Japan", accent: "green", whyItMatters: "JGB, OAT, gilt and global-duration moves can change repatriation, fragmentation and carry economics.", mechanism: "Global sovereign repricing → hedging / repatriation / fragmentation / carry → US duration and FX." },
      { key: "credit-financing", label: "Credit / CRE / Private Credit", accent: "yellow", whyItMatters: "Credit shows when high yields stop being a valuation problem and become a refinancing, collateral or forced-selling problem.", mechanism: "Funding cost + spreads + collateral values → refinancing / non-accruals / redemptions → bank and private-credit stress → broad credit / equity risk." },
      { key: "housing", label: "Housing / Real Economy", accent: "red", whyItMatters: "Housing is one of the clearest channels through which long yields reach households.", mechanism: "Treasury yields → mortgage rates → affordability / activity → growth and inflation." },
    ],
  },
  {
    slug: "us-china-ai",
    title: "AI Capital Cycle & US–China Competition",
    shortTitle: "AI Capital Cycle",
    coreQuestion: "Can AI revenue and utilisation compound fast enough to outrun financing, physical and control constraints while the US and China compete for strategic compute capacity?",
    whyItMatters: "The AI cycle now links model economics to chips, power, debt, SPVs, private capital, regulation and the return earned on a rapidly expanding infrastructure base.",
    mechanism: "AI demand → compute / power / capex → debt / SPVs / private capital → physical inflation → monetisation requirement → safety / regulatory constraint → utilisation / cash flow → credit quality / valuation.",
    affectedMarkets: ["NVDA", "MU", "AVGO", "CRWV", "ORCL", "META", "AMZN", "GOOGL", "MSFT", "BABA", "SMIC", "CXMT", "Semis", "Cloud", "Power", "IG", "HY"],
    subgroups: [
      { key: "models", label: "Models / Price War", accent: "blue", whyItMatters: "Cheaper intelligence can expand usage while compressing model economics.", mechanism: "Model price / quality → adoption → inference volume → monetisation." },
      { key: "chips", label: "Chips / Accelerators", accent: "purple", whyItMatters: "Accelerator access remains a strategic compute bottleneck.", mechanism: "Model demand → accelerator demand → supply / export controls → compute capacity." },
      { key: "memory", label: "Memory / HBM", accent: "orange", whyItMatters: "Memory bandwidth can constrain useful AI compute even when accelerators are available.", mechanism: "Inference / training → bandwidth demand → HBM capacity / pricing → system throughput." },
      { key: "cloud-inference", label: "Cloud / Inference", accent: "green", whyItMatters: "Inference economics determine whether falling model prices create profitable volume.", mechanism: "Usage → inference load → cloud utilisation → unit economics." },
      { key: "power", label: "Power / Data Centres", accent: "yellow", whyItMatters: "Power, cooling, grid equipment and construction can become the physical limit to AI deployment.", mechanism: "Compute buildout → data centres → electricity / grid / equipment → project timing and physical inflation." },
      { key: "financing", label: "Financing / Monetisation", accent: "red", whyItMatters: "The buildout only works if revenue, utilisation and cash generation can outrun binding infrastructure costs and financing expense.", mechanism: "Capex + debt / leases + borrowing cost → utilisation / revenue → cash conversion / coverage → project pace and valuation." },
      { key: "private-capital", label: "Private AI Capital", accent: "gold", whyItMatters: "Companies staying private longer shifts early upside, liquidity risk and delayed price discovery into institutional private capital.", mechanism: "Late-stage funding → private valuation / tender liquidity → IPO timing → institutional marks → compute and hiring capacity." },
      { key: "control-governance", label: "AI Control / Governance", accent: "teal", whyItMatters: "Safety incidents, liability and regulation can slow deployment while long-lived infrastructure obligations remain outstanding.", mechanism: "Capability growth → control failure / liability → safety gating / regulation → deployment timing → utilisation and monetisation." },
      { key: "policy", label: "Export Controls / Industrial Policy", accent: "teal", whyItMatters: "Industrial policy can reshape access to chips, equipment and strategic inputs.", mechanism: "Export controls / subsidies → supply access → localisation → competitive position." },
    ],
  },
  {
    slug: "energy-security-inflation",
    title: "Global Energy Security & Inflation",
    shortTitle: "Energy Security",
    coreQuestion: "Is marginal energy supply becoming structurally more expensive, fragile or politically constrained, and is that feeding inflation and rates?",
    whyItMatters: "Crude, products, LNG, shipping and power can transmit physical disruption into inflation, margins and central-bank policy.",
    mechanism: "Physical disruption → energy / freight cost → inflation and margins → central-bank room → yields / equities.",
    affectedMarkets: ["WTI", "Brent", "ULSD", "LNG", "US02Y", "US10Y", "XLE", "Industrials"],
    subgroups: [
      { key: "crude", label: "Crude", accent: "orange", whyItMatters: "Crude is the first-order global energy risk price, but it does not capture every product bottleneck.", mechanism: "Supply / geopolitics → crude balance → benchmark price → inflation impulse." },
      { key: "products", label: "Refining / Products", accent: "yellow", whyItMatters: "Diesel and gasoline can stay tight even when crude eases.", mechanism: "Refinery throughput + inventories → cracks / product prices → transport inflation." },
      { key: "lng", label: "LNG / Gas", accent: "blue", whyItMatters: "LNG disruption can force Europe and Asia to compete for Atlantic supply.", mechanism: "LNG flows → regional competition → gas / electricity → industrial margins." },
      { key: "shipping", label: "Shipping / Chokepoints", accent: "purple", whyItMatters: "Chokepoints and insurance determine whether physical supply can reach buyers.", mechanism: "Security risk → transit / insurance / freight → delivered energy cost." },
      { key: "power", label: "Power", accent: "green", whyItMatters: "Electricity is the final input linking gas, grids, industry and AI infrastructure.", mechanism: "Fuel + grid constraints → power price / availability → industrial and data-centre economics." },
      { key: "inflation", label: "Inflation Transmission", accent: "red", whyItMatters: "The market consequence depends on whether energy becomes broad, persistent inflation.", mechanism: "Energy / freight → CPI/PPI / expectations → policy pricing → rates." },
    ],
  },
  {
    slug: "gold-reserve-diversification",
    title: "Gold & Global Reserve Diversification",
    shortTitle: "Gold / Reserves",
    coreQuestion: "Is gold gaining a durable monetary and reserve role even when cyclical real-yield and dollar forces move against it?",
    whyItMatters: "Gold sits at the intersection of real yields, the dollar, geopolitical risk and central-bank reserve allocation.",
    mechanism: "Reserve diversification / geopolitical risk supports structural demand while real yields and USD drive cyclical opportunity cost.",
    affectedMarkets: ["XAUUSD", "DXY", "US10Y Real Yield", "Gold ETFs", "Central-bank reserves"],
    subgroups: [
      { key: "central-banks", label: "Central Banks", accent: "gold", whyItMatters: "Official-sector demand can create a structural bid independent of short-term investor flows.", mechanism: "Reserve allocation → official purchases → structural gold demand." },
      { key: "reserve-system", label: "USD / Reserve System", accent: "blue", whyItMatters: "Reserve diversification affects gold's monetary role relative to dollar assets.", mechanism: "Reserve preferences / sanctions risk → diversification → gold allocation." },
      { key: "real-yields", label: "Real Yields", accent: "orange", whyItMatters: "Real yields are a major cyclical opportunity-cost input for non-yielding gold.", mechanism: "Real yields ↑ → opportunity cost ↑ → cyclical gold headwind, all else equal." },
      { key: "geopolitics", label: "Geopolitics", accent: "purple", whyItMatters: "Sanctions and geopolitical fragmentation can alter reserve-management preferences.", mechanism: "Geopolitical / sanctions risk → reserve-security demand → gold." },
      { key: "investor-flows", label: "ETF / Investor Demand", accent: "green", whyItMatters: "Private flows determine whether structural official demand is being joined by investors.", mechanism: "Macro expectations / momentum → ETF and futures flows → marginal gold demand." },
    ],
  },
  {
    slug: "equity-rally-quality",
    title: "Equity Rally Quality & Earnings Breadth",
    shortTitle: "Equity Rally Quality",
    coreQuestion: "Is the equity advance becoming economically broader, or does it remain dependent on a narrow set of AI and large-cap earnings leaders?",
    whyItMatters: "A rally supported by earnings, breadth and credit is more robust than one carried by a narrow group of long-duration winners.",
    mechanism: "Earnings + breadth + financial conditions → participation and leadership → durability of equity risk appetite.",
    affectedMarkets: ["SPY", "QQQ", "RSP", "IWM", "SMH", "KRE", "XLF", "Earnings"],
    subgroups: [
      { key: "ai-leadership", label: "AI Leadership", accent: "purple", whyItMatters: "AI leadership can support indices while concealing weakness underneath.", mechanism: "AI earnings / capex → megacap leadership → index performance." },
      { key: "breadth", label: "Breadth", accent: "blue", whyItMatters: "Breadth tests whether participation is expanding beyond the leaders.", mechanism: "Participation → equal-weight / small-cap / sector confirmation → rally quality." },
      { key: "earnings", label: "Earnings", accent: "green", whyItMatters: "Forward earnings determine whether price gains have fundamental support.", mechanism: "Guidance / revisions → forward EPS → valuation support." },
      { key: "consumer", label: "Consumer", accent: "yellow", whyItMatters: "Household demand determines whether aggregate earnings can broaden beyond AI.", mechanism: "Income / spending → revenues / margins → earnings breadth." },
      { key: "financials", label: "Financials", accent: "teal", whyItMatters: "Banks and financials connect the curve, credit creation and domestic growth.", mechanism: "Curve / credit / loan demand → financial earnings → cyclical confirmation." },
      { key: "valuation-rates", label: "Valuation / Rates", accent: "red", whyItMatters: "High real yields can cap long-duration equity multiples even when earnings remain strong.", mechanism: "Real yields / cost of capital → discount rate → equity valuation." },
    ],
  },
];

const EXACT_STORY_ROUTES: Record<string, RegimeRoute[]> = {
  "ai-financing-stress": [
    { regime: "us-china-ai", subgroup: "financing", role: "core", score: 100 },
    { regime: "global-cost-of-capital", subgroup: "credit-financing", role: "bridge", score: 92 },
  ],
  "ai-control-risk": [
    { regime: "us-china-ai", subgroup: "control-governance", role: "core", score: 100 },
    { regime: "us-china-ai", subgroup: "financing", role: "bridge", score: 82 },
  ],
  "private-ai-capital": [
    { regime: "us-china-ai", subgroup: "private-capital", role: "core", score: 100 },
    { regime: "us-china-ai", subgroup: "financing", role: "supporting", score: 86 },
  ],
  "global-credit-transmission": [
    { regime: "global-cost-of-capital", subgroup: "credit-financing", role: "core", score: 100 },
    { regime: "equity-rally-quality", subgroup: "financials", role: "bridge", score: 88 },
  ],
  "global-sovereign-stress": [
    { regime: "global-cost-of-capital", subgroup: "global-rates", role: "core", score: 100 },
    { regime: "global-cost-of-capital", subgroup: "treasury-fiscal", role: "supporting", score: 86 },
    { regime: "gold-reserve-diversification", subgroup: "reserve-system", role: "bridge", score: 72 },
  ],
  "fed-rate-repricing": [
    { regime: "global-cost-of-capital", subgroup: "fed-front-end", role: "core", score: 100 },
    { regime: "energy-security-inflation", subgroup: "inflation", role: "bridge", score: 82 },
  ],
  "fed-long-end-stress": [
    { regime: "global-cost-of-capital", subgroup: "long-end", role: "core", score: 100 },
    { regime: "gold-reserve-diversification", subgroup: "real-yields", role: "supporting", score: 70 },
  ],
  "iran-oil-inflation-rates": [
    { regime: "energy-security-inflation", subgroup: "products", role: "core", score: 100 },
    { regime: "global-cost-of-capital", subgroup: "fed-front-end", role: "bridge", score: 78 },
  ],
  "market-breadth-health": [
    { regime: "equity-rally-quality", subgroup: "breadth", role: "core", score: 100 },
  ],
  "earnings-market-support": [
    { regime: "equity-rally-quality", subgroup: "earnings", role: "core", score: 100 },
    { regime: "equity-rally-quality", subgroup: "consumer", role: "supporting", score: 85 },
  ],
  "credit-cracks": [
    { regime: "global-cost-of-capital", subgroup: "credit-financing", role: "core", score: 100 },
    { regime: "equity-rally-quality", subgroup: "financials", role: "bridge", score: 85 },
  ],
  "housing-rates-transmission": [
    { regime: "global-cost-of-capital", subgroup: "housing", role: "core", score: 100 },
  ],
  "japan-jgb-yen": [
    { regime: "global-cost-of-capital", subgroup: "global-rates", role: "core", score: 100 },
  ],
  "sovereign-term-premium-stress": [
    { regime: "global-cost-of-capital", subgroup: "long-end", role: "core", score: 100 },
  ],
  "foreign-demand-de-dollarisation": [
    { regime: "gold-reserve-diversification", subgroup: "reserve-system", role: "core", score: 100 },
    { regime: "global-cost-of-capital", subgroup: "treasury-fiscal", role: "bridge", score: 90 },
  ],
  "gold-bitcoin-monetary-alternatives": [
    { regime: "gold-reserve-diversification", subgroup: "central-banks", role: "core", score: 95 },
  ],
  "fiscal-dominance": [
    { regime: "global-cost-of-capital", subgroup: "treasury-fiscal", role: "core", score: 100 },
    { regime: "gold-reserve-diversification", subgroup: "reserve-system", role: "bridge", score: 78 },
  ],
  "productivity-labor-share": [
    { regime: "equity-rally-quality", subgroup: "consumer", role: "supporting", score: 82 },
  ],
};

type TextRouteRule = {
  regime: RegimeSlug;
  subgroup: string;
  pattern: RegExp;
  weight: number;
};

const TEXT_ROUTE_RULES: TextRouteRule[] = [
  { regime: "global-cost-of-capital", subgroup: "fed-front-end", pattern: /\b(fed|fomc|policy rate|rate hike|rate cut|front[- ]end|2y|two[- ]year|fed funds)\b/i, weight: 5 },
  { regime: "global-cost-of-capital", subgroup: "treasury-fiscal", pattern: /\b(treasury|fiscal|deficit|debt supply|issuance|buyback|borrowing|tga|auction)\b/i, weight: 6 },
  { regime: "global-cost-of-capital", subgroup: "long-end", pattern: /\b(10y|30y|long[- ]end|term premium|duration|real yield|breakeven|mortgage rate)\b/i, weight: 6 },
  { regime: "global-cost-of-capital", subgroup: "global-rates", pattern: /\b(jgb|boj|japan|japanese|yen|usd.?jpy|dollar[- ]?yen|carry trade|carry unwind|global yield|global rates|yield gap|rate differential|relative rates|repatriat|bund|oat|oat[- ]bund|france|french sovereign|gilt|uk 30y|sovereign spread|fragmentation|tic|foreign treasury|treasury holdings|foreign demand|capital flow|intervention|ministry of finance|mof|hedging cost|cross[- ]?currency basis|fx swap)\b/i, weight: 7 },
  { regime: "global-cost-of-capital", subgroup: "credit-financing", pattern: /\b(stable[- ]value|wrap providers?|insurer insolvenc|insurance counterparty|liquidity run|participant liquidity|plan[- ]level stress|recordkeeper)\b/i, weight: 7 },
  { regime: "global-cost-of-capital", subgroup: "credit-financing", pattern: /\b(credit|spread|refinanc|funding|bond issuance|project finance|leverage|debt-funded|cmbs|cre|commercial real estate|private credit|special servicing|non[- ]accrual|redemption|gate|bank provision|forced sell)\b/i, weight: 6 },
  { regime: "global-cost-of-capital", subgroup: "housing", pattern: /\b(housing|mortgage|homebuilder|home sales|affordability)\b/i, weight: 5 },

  { regime: "us-china-ai", subgroup: "models", pattern: /\b(openai|chatgpt|gpt[- ]?\d+|gemini|claude|deepseek|qwen|glm|minimax|frontier model|model release|model launch|model deployment|model price|token price|open[- ]source ai|ai model|inference price)\b/i, weight: 6 },
  { regime: "us-china-ai", subgroup: "chips", pattern: /\b(nvidia|nvda|ascend|accelerator|gpu|smic|ai chip|semiconductor)\b/i, weight: 5 },
  { regime: "us-china-ai", subgroup: "memory", pattern: /\b(hbm|high bandwidth memory|dram|cxmt|micron|sk hynix|memory chip)\b/i, weight: 6 },
  { regime: "us-china-ai", subgroup: "cloud-inference", pattern: /\b(compute demand|compute usage|api demand|api usage|paid api|enterprise ai demand|enterprise ai contract|hyperscaler procurement)\b/i, weight: 7 },
  { regime: "us-china-ai", subgroup: "cloud-inference", pattern: /\b(inference|cloud|api price|token cost|ai usage|ai adoption)\b/i, weight: 4 },
  { regime: "us-china-ai", subgroup: "power", pattern: /\b(data cent(?:er|re)|power grid|electricity|cooling|ai infrastructure)\b/i, weight: 5 },
  { regime: "us-china-ai", subgroup: "financing", pattern: /\b(ai financ|ai capex|hyperscaler capex|ai debt|return on capital|roic|cash conversion|coreweave|oracle|anthropic|blue owl|beignet|spv|vendor financ|customer prepay|residual value guarantee|utilisation|coverage ratio)\b/i, weight: 7 },
  { regime: "us-china-ai", subgroup: "private-capital", pattern: /\b(private ai|private market|late[- ]stage|secondary market|tender offer|private valuation|down round|venture fund|employee liquidity|ai ipo|pre[- ]ipo)\b/i, weight: 7 },
  { regime: "us-china-ai", subgroup: "control-governance", pattern: /\b(ai safety|frontier ai|agentic attack|ai agent incident|prompt injection|containment|sandbox escape|model escape|superintelligence|ai liability|ai insurance|training pause|release pause|deployment pause|restricted release|trusted testers?|capability gate|safety gate|ai governance)\b/i, weight: 8 },
  { regime: "us-china-ai", subgroup: "policy", pattern: /\b(export control|chip ban|industrial policy|subsid|entity list|technology restriction)\b/i, weight: 5 },

  { regime: "energy-security-inflation", subgroup: "crude", pattern: /\b(wti|brent|crude|oil supply|opec|oil price)\b/i, weight: 5 },
  { regime: "energy-security-inflation", subgroup: "products", pattern: /\b(diesel|ulsd|gasoline|refin|distillate|crack spread|padd)\b/i, weight: 6 },
  { regime: "energy-security-inflation", subgroup: "lng", pattern: /\b(lng|natural gas|qatar gas|ttf|jkm)\b/i, weight: 6 },
  { regime: "energy-security-inflation", subgroup: "shipping", pattern: /\b(hormuz|shipping|freight|marine insurance|shipping insurance|tanker insurance|tanker|chokepoint|vessel)\b/i, weight: 6 },
  { regime: "energy-security-inflation", subgroup: "power", pattern: /\b(electricity|power price|power grid|utility)\b/i, weight: 4 },
  { regime: "energy-security-inflation", subgroup: "inflation", pattern: /\b(energy inflation|fuel inflation|cpi|ppi|inflation expectations)\b/i, weight: 4 },

  { regime: "gold-reserve-diversification", subgroup: "central-banks", pattern: /\b(central bank gold|official gold|gold reserves|gold purchase)\b/i, weight: 7 },
  { regime: "gold-reserve-diversification", subgroup: "reserve-system", pattern: /\b(reserve diversification|de[- ]dollar|foreign reserves|reserve currency|sanctions risk)\b/i, weight: 6 },
  { regime: "gold-reserve-diversification", subgroup: "real-yields", pattern: /\b(real yield|tips yield|gold.*yield|yield.*gold)\b/i, weight: 5 },
  { regime: "gold-reserve-diversification", subgroup: "geopolitics", pattern: /\b(gold.*geopolit|geopolit.*gold|reserve seizure|sanctions.*reserve)\b/i, weight: 5 },
  { regime: "gold-reserve-diversification", subgroup: "investor-flows", pattern: /\b(gold etf|gold flow|xauusd|gold futures|gold demand)\b/i, weight: 5 },

  { regime: "equity-rally-quality", subgroup: "ai-leadership", pattern: /\b(ai leadership|megacap|mag7|semiconductor leadership|nasdaq leadership)\b/i, weight: 5 },
  { regime: "equity-rally-quality", subgroup: "breadth", pattern: /\b(breadth|advance.?decline|equal[- ]weight|rsp|small cap|iwm|52[- ]week highs)\b/i, weight: 6 },
  { regime: "equity-rally-quality", subgroup: "earnings", pattern: /\b(earnings|eps|guidance|forward eps|revision)\b/i, weight: 5 },
  { regime: "equity-rally-quality", subgroup: "consumer", pattern: /\b(consumer|retail sales|discretionary|household|real earnings)\b/i, weight: 4 },
  { regime: "equity-rally-quality", subgroup: "financials", pattern: /\b(financials|banks|bank|wealth manager|xlf|kre|net interest margin)\b/i, weight: 5 },
  { regime: "equity-rally-quality", subgroup: "valuation-rates", pattern: /\b(equity valuation|discount rate|multiple compression|duration stock|growth stock|real yields)\b/i, weight: 4 },
];

function latestVersionsByStory(versions: StoryThesisVersion[]) {
  const map = new Map<string, StoryThesisVersion>();
  for (const version of versions) {
    const existing = map.get(version.story_id);
    if (!existing || version.version_number > existing.version_number || (
      version.version_number === existing.version_number && version.effective_at > existing.effective_at
    )) {
      map.set(version.story_id, version);
    }
  }
  return map;
}

const EPISODIC_STORY_SLUGS = new Set([
  "rates-led-same-session-repricing-overwhelms-summit-optics",
]);

export function classifyRegimeStory(
  story: Story,
  version?: StoryThesisVersion | null,
): {
  maturity: RegimeStoryMaturity;
  contributesToState: boolean;
  reason: string;
} {
  const confidence = version?.confidence ?? story.confidence;
  const lifecycle = String(version?.status || story.status || "").trim().toLowerCase();
  const editorialVerdict = String(version?.article_verdict ?? story.article_verdict ?? "").trim().toLowerCase();

  if (EPISODIC_STORY_SLUGS.has(story.slug)) {
    return {
      maturity: "episode",
      contributesToState: false,
      reason: "Legacy event-like Story retained for context; it is too time-specific to define a durable Regime branch.",
    };
  }

  if (editorialVerdict === "theme_seed_unverified") {
    return {
      maturity: "seed",
      contributesToState: false,
      reason: "Unverified theme seed: keep the branch visible, but do not let it drive Regime interpretation before evidence matures.",
    };
  }

  if (version && storyFramingDependsOnExpiredCatalyst({
    title: version.title || story.title,
    thesis: version.thesis || story.thesis,
    version,
  })) {
    return {
      maturity: "stale",
      contributesToState: false,
      reason: "The deciding catalyst expired while the accepted Story framing still depends on it. Keep it visible as context until canonical evidence produces a current reframe.",
    };
  }

  if (confidence < 25) {
    return {
      maturity: "early",
      contributesToState: false,
      reason: `Early Story at ${confidence}% thesis confidence; visible for monitoring but below the Regime contribution gate.`,
    };
  }

  if (/invalid|archive|dormant/.test(lifecycle)) {
    return {
      maturity: "early",
      contributesToState: false,
      reason: `Lifecycle is ${lifecycle || "inactive"}; retained for context but excluded from current Regime state.`,
    };
  }

  return {
    maturity: "durable",
    contributesToState: true,
    reason: "Accepted persistent Story with enough maturity to contribute to Regime interpretation.",
  };
}

function storyText(story: Story, version?: StoryThesisVersion | null) {
  return [
    story.slug,
    version?.title || story.title,
    version?.thesis || story.thesis,
    version?.market_question || story.market_question || "",
    ...(version?.assets || story.assets || []),
  ].join(" ");
}

function uniqueRoutes(routes: RegimeRoute[]) {
  const sorted = [...routes].sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const output: RegimeRoute[] = [];
  for (const route of sorted) {
    const key = `${route.regime}:${route.subgroup}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(route);
  }
  return output;
}

export function routeTextToRegimes(text: string, limit = 2): RegimeRoute[] {
  const scores = new Map<string, RegimeRoute>();
  for (const rule of TEXT_ROUTE_RULES) {
    if (!rule.pattern.test(text)) continue;
    const key = `${rule.regime}:${rule.subgroup}`;
    const existing = scores.get(key);
    if (!existing || rule.weight > existing.score) {
      scores.set(key, {
        regime: rule.regime,
        subgroup: rule.subgroup,
        role: "supporting",
        score: rule.weight,
      });
    }
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score || a.regime.localeCompare(b.regime))
    .slice(0, Math.max(0, limit));
}

export function routeStoryToRegimes(story: Story, version?: StoryThesisVersion | null): RegimeRoute[] {
  const exact = EXACT_STORY_ROUTES[story.slug];
  if (exact?.length) return uniqueRoutes(exact).slice(0, 3);

  const routed = routeTextToRegimes(storyText(story, version), 3);
  if (!routed.length) return [];
  return routed.map((route, index) => ({
    ...route,
    role: index === 0 ? "core" : "supporting",
    score: route.score * 10,
  }));
}

function eventState(event: StoryEvent): RegimeNodeState {
  if (event.impact === "supports" || event.impact === "amplifies") return "supports";
  if (event.impact === "contradicts") return "contradicts";
  if (event.impact === "stale") return "context";
  if (event.event_type === "invalidation") return "contradicts";
  if (event.event_type === "confirmation") return "supports";
  return "unresolved";
}

function timestampMax(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
}

function deriveInterpretedState(stories: ProjectedStory[], nodes: RegimeContributionNode[]) {
  if (!stories.length && !nodes.length) return { state: "Unresolved", kind: "unresolved" as const };
  const interpreted = nodes.filter((node) => node.state !== "interpretation_pending");
  const supports = interpreted.filter((node) => node.state === "supports").length;
  const contradicts = interpreted.filter((node) => node.state === "contradicts").length;
  if (supports && contradicts) return { state: "Mixed / contested", kind: "interpreted" as const };
  if (contradicts > supports) return { state: "Under pressure", kind: "interpreted" as const };
  if (supports > 0) return { state: "Strengthening", kind: "interpreted" as const };
  if (stories.length) return { state: "Active / unresolved", kind: "interpreted" as const };
  return { state: "Unresolved", kind: "unresolved" as const };
}

function rateStateLabel(state: DossierPresentationV1["rateRegime"]["state"]) {
  if (state === "HAWKISH") return "Restrictive";
  if (state === "DOVISH") return "Easing";
  if (state === "MIXED") return "Mixed";
  if (state === "NEUTRAL") return "Neutral";
  return "Unresolved";
}

function rateDirectionLabel(value: "UP" | "DOWN" | "FLAT" | "UNRESOLVED") {
  if (value === "UP") return "Restrictive / tighter";
  if (value === "DOWN") return "Easing";
  if (value === "FLAT") return "Flat";
  return "Unresolved";
}

function signalSubgroup(key: string) {
  if (key === "POLICY" || key === "FRONT_END") return "fed-front-end";
  if (key === "TREASURY_SUPPLY") return "treasury-fiscal";
  if (key === "REAL_YIELDS" || key === "BREAKEVENS" || key === "LONG_END") return "long-end";
  return null;
}

function rawNodeRoutes(text: string) {
  return routeTextToRegimes(text, 1);
}

function candidateNewsNodes(news: NewsThread[], statements: PublicStatement[]) {
  const output: Array<{ route: RegimeRoute; node: RegimeContributionNode }> = [];

  for (const item of news) {
    const text = `${item.category || ""} ${item.headline} ${item.summary || ""} ${item.current_view || ""} ${(item.affected_assets || []).join(" ")}`;
    const route = rawNodeRoutes(text)[0];
    if (!route) continue;
    output.push({
      route,
      node: {
        id: `news:${item.id}`,
        title: item.headline,
        detail: item.current_view || item.summary || "Verified news record awaiting Story interpretation.",
        timestamp: item.published_at,
        state: "interpretation_pending",
        sourceKind: "news",
        verification: item.source_type,
        storyId: null,
        storySlug: null,
        href: item.source_url || null,
        hybridHref: null,
      },
    });
  }

  for (const item of statements) {
    const text = `${item.speaker} ${item.topic} ${item.market_interpretation || ""} ${item.quote_excerpt || ""} ${(item.affected_assets || []).join(" ")}`;
    const route = rawNodeRoutes(text)[0];
    if (!route) continue;
    output.push({
      route,
      node: {
        id: `statement:${item.id}`,
        title: `${item.speaker}: ${item.topic}`,
        detail: item.market_interpretation || item.quote_excerpt || "Verified statement awaiting Story interpretation.",
        timestamp: item.statement_date,
        state: "interpretation_pending",
        sourceKind: "statement",
        verification: item.verification_status,
        storyId: null,
        storySlug: null,
        href: item.source_url || null,
        hybridHref: null,
      },
    });
  }

  return output;
}

function dossierRegimeContextNodes(
  dossier: DossierPresentationV1 | null,
  regimeSlug: RegimeSlug,
): RegimeContributionNode[] {
  if (!dossier) return [];

  return (dossier.motionRegimeContext ?? [])
    .filter((item) => item.regimeSlug === regimeSlug)
    .map((item) => ({
      id: `dossier-motion:${dossier.dossierId}:${item.motionId}`,
      title: item.conclusion,
      detail: item.rationale,
      timestamp: item.observedAt || dossier.asOf,
      state: "context" as const,
      sourceKind: "dossier_motion" as const,
      verification: `dossier-system2:${item.decision.toLowerCase()}`,
      storyId: item.storyId,
      storySlug: null,
      href: null,
      hybridHref: `/hybrid-output?regime=${encodeURIComponent(regimeSlug)}&motion=${encodeURIComponent(item.motionId)}#dossier-regime-context`,
    }))
    .sort((left, right) =>
      Date.parse(right.timestamp || "") - Date.parse(left.timestamp || "")
      || left.id.localeCompare(right.id)
    )
    .slice(0, 4);
}

export function buildRegimeProjection(input: {
  stories: Story[];
  events: StoryEvent[];
  versions: StoryThesisVersion[];
  newsThreads: NewsThread[];
  statements: PublicStatement[];
  dossier: DossierPresentationV1 | null;
}): ProjectedRegime[] {
  const latestVersion = latestVersionsByStory(input.versions);
  const projectedStories: ProjectedStory[] = input.stories.map((story) => {
    const version = latestVersion.get(story.id) || null;
    const routes = routeStoryToRegimes(story, version);
    const maturity = classifyRegimeStory(story, version);
    return {
      id: story.id,
      slug: story.slug,
      title: version?.title || story.title,
      thesis: version?.thesis || story.thesis,
      question: version?.market_question || story.market_question,
      confidence: version?.confidence ?? story.confidence,
      lifecycle: version?.status || story.status,
      editorialVerdict: version?.article_verdict ?? story.article_verdict,
      assets: version?.assets || story.assets || [],
      versionId: version?.id || null,
      versionNumber: version?.version_number ?? null,
      routes,
      maturity: maturity.maturity,
      contributesToState: maturity.contributesToState,
      maturityReason: maturity.reason,
      hybridHref: `/hybrid-output?story=${encodeURIComponent(story.slug)}`,
    };
  });

  const projectedByStory = new Map(projectedStories.map((story) => [story.id, story]));
  const rawNodes = candidateNewsNodes(input.newsThreads, input.statements);

  return REGIME_DEFINITIONS.map((definition) => {
    const regimeStories = projectedStories.filter((story) => story.routes.some((route) => route.regime === definition.slug));
    const eventNodesBySubgroup = new Map<string, RegimeContributionNode[]>();

    for (const event of input.events) {
      const story = projectedByStory.get(event.story_id);
      if (!story) continue;
      const routes = story.routes.filter((route) => route.regime === definition.slug);
      for (const route of routes) {
        const list = eventNodesBySubgroup.get(route.subgroup) || [];
        list.push({
          id: `event:${event.id}`,
          title: event.headline,
          detail: event.detail || "Story event recorded without additional detail.",
          timestamp: event.event_at,
          state: story.contributesToState ? eventState(event) : "context",
          sourceKind: "story_event",
          verification: event.impact,
          storyId: story.id,
          storySlug: story.slug,
          href: `/stories/${story.slug}#event-${event.id}`,
          hybridHref: `/hybrid-output?event=${encodeURIComponent(event.id)}`,
        });
        eventNodesBySubgroup.set(route.subgroup, list);
      }
    }

    for (const item of rawNodes.filter((item) => item.route.regime === definition.slug)) {
      const list = eventNodesBySubgroup.get(item.route.subgroup) || [];
      list.push(item.node);
      eventNodesBySubgroup.set(item.route.subgroup, list);
    }

    const subgroups: ProjectedRegimeSubgroup[] = definition.subgroups.map((subgroup) => {
      const stories = regimeStories
        .filter((story) => story.routes.some((route) => route.regime === definition.slug && route.subgroup === subgroup.key))
        .sort((left, right) => Number(right.contributesToState) - Number(left.contributesToState) || right.confidence - left.confidence || left.title.localeCompare(right.title));
      const durableStories = stories.filter((story) => story.contributesToState);
      const contextStories = stories.filter((story) => !story.contributesToState);
      const nodes = (eventNodesBySubgroup.get(subgroup.key) || [])
        .sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""))
        .slice(0, 6);

      const telemetry: RegimeTelemetryItem[] = [];
      if (definition.slug === "global-cost-of-capital" && input.dossier?.rateRegime) {
        for (const signal of input.dossier.rateRegime.signals || []) {
          if (signalSubgroup(signal.key) !== subgroup.key) continue;
          telemetry.push({
            key: signal.key,
            label: signal.label,
            state: rateStateLabel(signal.state),
            detail: signal.detail,
            asOf: input.dossier.rateRegime.asOf || input.dossier.asOf,
            source: input.dossier.rateRegime.contractVersion || "rate-regime",
          });
        }
        if (subgroup.key === "long-end" && input.dossier.rateRegime.curve) {
          telemetry.push({
            key: "CURVE",
            label: "2Y / 10Y curve",
            state: input.dossier.rateRegime.curve.state.replaceAll("_", " "),
            detail: input.dossier.rateRegime.curve.detail,
            asOf: input.dossier.rateRegime.asOf || input.dossier.asOf,
            source: input.dossier.rateRegime.contractVersion || "rate-regime",
          });
        }
        if (input.dossier.rateRegime.curveDiagnostic && subgroup.key === "fed-front-end") {
          telemetry.push({
            key: "RATE_PATH_FRONT_END",
            label: "Front-end curve path",
            state: rateDirectionLabel(input.dossier.rateRegime.curveDiagnostic.frontEndDirection),
            detail: `2Y 5D move ${input.dossier.rateRegime.curveDiagnostic.frontEndChange5dBp === null ? "unavailable" : `${input.dossier.rateRegime.curveDiagnostic.frontEndChange5dBp >= 0 ? "+" : ""}${input.dossier.rateRegime.curveDiagnostic.frontEndChange5dBp.toFixed(1)} bp`}. ${input.dossier.rateRegime.curveDiagnostic.separationState.replaceAll("_", " ").toLowerCase()}.`,
            asOf: input.dossier.rateRegime.curveDiagnostic.asOf,
            source: input.dossier.rateRegime.curveDiagnostic.contractVersion,
          });
        }
        if (input.dossier.rateRegime.curveDiagnostic && subgroup.key === "long-end") {
          telemetry.push({
            key: "RATE_PATH_LONG_END",
            label: "Long-end curve path",
            state: rateDirectionLabel(input.dossier.rateRegime.curveDiagnostic.longEndDirection),
            detail: input.dossier.rateRegime.curveDiagnostic.detail,
            asOf: input.dossier.rateRegime.curveDiagnostic.asOf,
            source: input.dossier.rateRegime.curveDiagnostic.contractVersion,
          });
          telemetry.push({
            key: "CURVE_MOVE_CLASS",
            label: "Curve move class",
            state: input.dossier.rateRegime.curveDiagnostic.moveClass.replaceAll("_", " "),
            detail: `Front-end vs long-end: ${input.dossier.rateRegime.curveDiagnostic.separationState.replaceAll("_", " ").toLowerCase()}.`,
            asOf: input.dossier.rateRegime.curveDiagnostic.asOf,
            source: input.dossier.rateRegime.curveDiagnostic.contractVersion,
          });
        }
        if (input.dossier.rateRegime.longEndDiagnostic && subgroup.key === "long-end") {
          telemetry.push({
            key: "LONG_END_DECOMPOSITION",
            label: "Observed long-end decomposition",
            state: input.dossier.rateRegime.longEndDiagnostic.observedDecomposition.state.replaceAll("_", " "),
            detail: input.dossier.rateRegime.longEndDiagnostic.observedDecomposition.detail,
            asOf: input.dossier.rateRegime.longEndDiagnostic.asOf,
            source: input.dossier.rateRegime.longEndDiagnostic.contractVersion,
          });
          telemetry.push({
            key: "TERM_PREMIUM_EVIDENCE",
            label: "Term-premium evidence",
            state: input.dossier.rateRegime.longEndDiagnostic.termPremium.availability,
            detail: input.dossier.rateRegime.longEndDiagnostic.termPremium.detail,
            asOf: input.dossier.rateRegime.longEndDiagnostic.asOf,
            source: input.dossier.rateRegime.longEndDiagnostic.contractVersion,
          });
        }
        if (input.dossier.rateRegime.longEndDiagnostic && subgroup.key === "treasury-fiscal") {
          telemetry.push({
            key: "TREASURY_MARKET_STRUCTURE",
            label: "Treasury market structure",
            state: input.dossier.rateRegime.longEndDiagnostic.marketStructure.auctionEvidenceRef || input.dossier.rateRegime.longEndDiagnostic.marketStructure.dealerEvidenceRef
              ? "Observed / interpretation pending"
              : "Unresolved",
            detail: input.dossier.rateRegime.longEndDiagnostic.marketStructure.detail,
            asOf: input.dossier.rateRegime.longEndDiagnostic.asOf,
            source: input.dossier.rateRegime.longEndDiagnostic.contractVersion,
          });
        }
        if (input.dossier.rateRegime.globalDurationDiagnostic && subgroup.key === "global-rates") {
          const global = input.dossier.rateRegime.globalDurationDiagnostic;
          telemetry.push({
            key: "UST_JGB_RELATIVE_RATES",
            label: "UST ↔ JGB relative rates",
            state: global.relativeRates.state.replaceAll("_", " "),
            detail: global.relativeRates.detail,
            asOf: global.asOf,
            source: global.contractVersion,
          });
          telemetry.push({
            key: "USDJPY_RATE_BRIDGE",
            label: "USDJPY",
            state: global.fx.evidenceRef ? "Observed" : "Unresolved",
            detail: global.fx.detail,
            asOf: global.asOf,
            source: global.contractVersion,
          });
          telemetry.push({
            key: "TIC_FOREIGN_TREASURY_DEMAND",
            label: "TIC foreign Treasury holdings",
            state: global.foreignTreasuryDemand.japanHoldingsDirection.replaceAll("_", " "),
            detail: global.foreignTreasuryDemand.detail,
            asOf: global.asOf,
            source: global.contractVersion,
          });
          telemetry.push({
            key: "JAPAN_MOF_PORTFOLIO_FLOWS",
            label: "Japan MOF foreign securities flows",
            state: global.japanPortfolioFlows.direction.replaceAll("_", " "),
            detail: global.japanPortfolioFlows.detail,
            asOf: global.asOf,
            source: global.contractVersion,
          });
        }
        if (subgroup.key === "credit-financing" && input.dossier.dollarLiquidity) {
          for (const component of input.dossier.dollarLiquidity.components.filter((component) => component.key === "CREDIT" || component.key === "FUNDING")) {
            telemetry.push({
              key: `LIQUIDITY_${component.key}`,
              label: component.label,
              state: component.direction.replaceAll("_", " "),
              detail: component.detail,
              asOf: input.dossier.dollarLiquidity.asOf,
              source: input.dossier.dollarLiquidity.contractVersion,
            });
          }
        }
      }

      const interpreted = deriveInterpretedState(durableStories, nodes);
      const telemetryState = telemetry.length
        ? telemetry.some((item) => /restrict|hawk|tight/i.test(item.state))
          ? "Restrictive / tighter"
          : telemetry.some((item) => /eas|dovish/i.test(item.state))
            ? "Easing"
            : telemetry.some((item) => /mixed/i.test(item.state))
              ? "Mixed"
              : telemetry[0].state
        : null;

      return {
        ...subgroup,
        state: telemetryState || interpreted.state,
        stateKind: telemetryState ? "system1" : interpreted.kind,
        stories,
        durableStories,
        contextStories,
        nodes,
        telemetry,
        latestAt: timestampMax([
          ...nodes.map((node) => node.timestamp),
          ...telemetry.map((item) => item.asOf),
        ]),
      };
    });

    const durableRegimeStories = regimeStories.filter((story) => story.contributesToState);
    const contextRegimeStories = regimeStories.filter((story) => !story.contributesToState);
    const dossierContext = dossierRegimeContextNodes(input.dossier, definition.slug);
    const allNodes = [
      ...dossierContext,
      ...subgroups.flatMap((subgroup) => subgroup.nodes),
    ].sort((a, b) =>
      Date.parse(b.timestamp || "") - Date.parse(a.timestamp || "")
      || a.id.localeCompare(b.id)
    );
    const isRates = definition.slug === "global-cost-of-capital" && input.dossier?.rateRegime;
    const rateSensorState = isRates ? rateStateLabel(input.dossier!.rateRegime.state) : null;

    // Parent Regimes are broader than any one deterministic sensor. Until the
    // persisted Regime/System-2 projector exists, keep parent direction
    // deliberately partial rather than promoting the Dossier rate sensor into
    // a whole-Regime conclusion.
    const state = isRates
      ? `Rates ${rateSensorState!.toLowerCase()} · broader funding partial`
      : durableRegimeStories.length
        ? "Active / durable Stories"
        : regimeStories.length
          ? "Coverage gap / non-durable Stories"
          : "Unresolved";
    const stateKind = isRates
      ? "unresolved" as const
      : durableRegimeStories.length
        ? "interpreted" as const
        : "unresolved" as const;
    const confidence = isRates
      ? `PARTIAL · rates ${input.dossier!.rateRegime.confidence || "UNRESOLVED"}`
      : durableRegimeStories.length
        ? "DURABLE STORY-LED"
        : regimeStories.length
          ? "COVERAGE GAP"
          : "UNRESOLVED";

    return {
      ...definition,
      state,
      stateKind,
      confidence,
      asOf: timestampMax([
        ...(isRates ? [input.dossier!.rateRegime.asOf || input.dossier!.asOf] : []),
        ...dossierContext.map((node) => node.timestamp),
        ...subgroups.map((subgroup) => subgroup.latestAt),
      ]),
      stories: regimeStories,
      durableStories: durableRegimeStories,
      contextStories: contextRegimeStories,
      latestNode: allNodes[0] || null,
      dossierContext,
      subgroups,
      hybridHref: `/hybrid-output?regime=${encodeURIComponent(definition.slug)}`,
    };
  });
}

export function getRegimeDefinition(slug: string) {
  return REGIME_DEFINITIONS.find((regime) => regime.slug === slug) || null;
}

export function getRegimeForStory(story: Story, version?: StoryThesisVersion | null) {
  const route = routeStoryToRegimes(story, version)[0];
  return route ? REGIME_DEFINITIONS.find((regime) => regime.slug === route.regime) || null : null;
}
