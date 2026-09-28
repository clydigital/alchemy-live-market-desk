import type { NewsThread, PublicStatement, Story } from "./data.ts";
import type { DossierPresentationV1 } from "./dossier-v2/presentation-adapter.ts";
import type { StoryEvent, StoryThesisVersion } from "./persistence/contracts.ts";

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

export type RegimeMechanismChain = {
  label: string;
  steps: string[];
  marketImplication: string;
};

export type RegimeConcept = {
  name: string;
  definition: string;
  whyHere: string;
};

export type RegimeDefinition = {
  slug: RegimeSlug;
  title: string;
  shortTitle: string;
  coreQuestion: string;
  whyItMatters: string;
  mechanism: string;
  mechanismChains: RegimeMechanismChain[];
  concepts: RegimeConcept[];
  counterfactual: string;
  affectedMarkets: string[];
  subgroups: RegimeSubgroupDefinition[];
};

export type RegimeRoute = {
  regime: RegimeSlug;
  subgroup: string;
  role: "core" | "supporting" | "bridge";
  score: number;
};

export type RegimeStoryMaturity = "durable" | "early" | "seed" | "episode";

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
  sourceKind: "story_event" | "news" | "statement";
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
  subgroups: ProjectedRegimeSubgroup[];
  hybridHref: string;
};

export const REGIME_DEFINITIONS: RegimeDefinition[] = [
  {
    slug: "global-cost-of-capital",
    title: "Sovereign Funding & Global Cost of Capital",
    shortTitle: "Cost of Capital",
    coreQuestion: "Can governments and companies finance large capital needs cheaply while inflation, sovereign issuance and private investment demand keep required returns elevated?",
    whyItMatters: "Long-term yields and funding conditions transmit into mortgages, corporate borrowing, AI financing, equity valuations, currencies and the government's own interest burden.",
    mechanism: "Debt supply / inflation / policy pressure → required yields → borrowing costs → investment, housing and valuation pressure.",
    mechanismChains: [
      {
        label: "Sovereign supply → economy-wide borrowing cost",
        steps: ["Treasury borrowing / issuance ↑", "Investor absorption burden / term premium ↑", "10Y–30Y required yield ↑", "Mortgage + corporate borrowing costs ↑", "Housing, capex and equity valuation face pressure"],
        marketImplication: "The long end can tighten financial conditions even when the Fed is not actively hiking.",
      },
      {
        label: "Inflation → policy path → front-end pricing",
        steps: ["Inflation / energy pressure ↑", "Expected Fed easing ↓ or hiking risk ↑", "2Y and real yields ↑", "USD / financing hurdle ↑", "Long-duration assets reprice"],
        marketImplication: "The front end tells us whether inflation is changing the expected policy path.",
      },
      {
        label: "Japan / global duration spillover",
        steps: ["JGB yields / Japan policy normalisation ↑", "Domestic Japanese return hurdle ↑", "Repatriation / hedging / carry economics change", "Demand for foreign duration can weaken", "US/global long yields face extra pressure"],
        marketImplication: "US rates can be affected by global capital allocation, not only US data.",
      },
    ],
    concepts: [
      { name: "Term premium", definition: "The extra yield investors demand to hold a long bond instead of rolling short maturities.", whyHere: "It can push 10Y/30Y yields higher even without a higher expected Fed path." },
      { name: "Real yield", definition: "Nominal Treasury yield minus expected inflation.", whyHere: "A higher real yield raises the discount rate faced by gold, housing and long-duration equities." },
      { name: "Duration", definition: "Sensitivity of an asset or bond price to changes in interest rates.", whyHere: "Long-duration equities and long bonds are most exposed when required yields rise." },
      { name: "Treasury buyback", definition: "Treasury purchases outstanding securities while separately financing government cash needs through issuance.", whyHere: "It can improve market functioning or alter maturity composition without eliminating the underlying borrowing need." },
      { name: "Refinancing risk", definition: "The risk that debt must be rolled at materially higher interest rates.", whyHere: "It links today's yields to future corporate, household and sovereign interest expense." },
    ],
    counterfactual: "This Regime would materially ease if inflation and issuance pressure faded, auctions cleared cleanly, real yields fell and credit/housing borrowing costs followed lower without a new growth or inflation shock.",
    affectedMarkets: ["US02Y", "US10Y", "US30Y", "DXY", "XAUUSD", "QQQ", "Credit", "Housing"],
    subgroups: [
      { key: "fed-front-end", label: "Fed / Front End", accent: "blue", whyItMatters: "The front end shows how markets price the near-term policy path.", mechanism: "Macro surprise → Fed path → 2Y / policy pricing → USD and rate-sensitive assets." },
      { key: "treasury-fiscal", label: "Treasury / Fiscal", accent: "purple", whyItMatters: "Borrowing needs and maturity choices affect supply, refinancing risk and the term premium.", mechanism: "Deficits / financing mix → Treasury supply → investor absorption → funding pressure." },
      { key: "long-end", label: "Long End / Term Premium", accent: "orange", whyItMatters: "The 10Y/30Y anchor mortgages, corporate finance and discount rates.", mechanism: "Inflation + supply + real yields + term premium → 10Y/30Y → economy-wide cost of capital." },
      { key: "global-rates", label: "Global Rates / Japan", accent: "green", whyItMatters: "JGB and global duration moves can change cross-border capital and carry economics.", mechanism: "Global yield repricing → hedging / repatriation / carry → US duration and FX." },
      { key: "credit-financing", label: "Credit / Financing", accent: "yellow", whyItMatters: "Credit reveals whether high rates are becoming an actual financing constraint.", mechanism: "Funding cost / spreads → issuance and refinancing → capex / defaults / equity risk." },
      { key: "housing", label: "Housing / Real Economy", accent: "red", whyItMatters: "Housing is one of the clearest channels through which long yields reach households.", mechanism: "Treasury yields → mortgage rates → affordability / activity → growth and inflation." },
    ],
  },
  {
    slug: "us-china-ai",
    title: "US–China AI Industrial Competition",
    shortTitle: "US–China AI",
    coreQuestion: "Which ecosystem captures the economics and physical infrastructure of AI as intelligence becomes cheaper and compute becomes strategically important?",
    whyItMatters: "Model pricing, chips, memory, power and financing determine where value migrates as AI usage scales and margins are pressured.",
    mechanism: "AI price ↓ → adoption / inference ↑ → compute, memory and power demand ↑, while monetisation pressure can lower returns on capex.",
    mechanismChains: [
      {
        label: "AI price war → physical demand",
        steps: ["Model / token price ↓", "AI adoption and usage ↑", "Inference volume ↑", "Accelerator + HBM + network demand ↑", "Data-centre power and cooling demand ↑"],
        marketImplication: "Cheaper intelligence can be bullish for physical AI infrastructure even while software/model pricing compresses.",
      },
      {
        label: "Cheap intelligence → monetisation test",
        steps: ["Model price ↓", "Revenue per unit of intelligence ↓", "Usage must scale faster to protect gross profit", "Cash conversion / ROIC becomes more important", "Capex pace and valuation depend on realised returns"],
        marketImplication: "Usage growth is not automatically the same as profitable AI economics.",
      },
      {
        label: "US–China localisation race",
        steps: ["Export controls / strategic restrictions ↑", "Chinese localisation incentive ↑", "Domestic accelerators + memory + equipment investment ↑", "Supply-chain substitution ↑", "Competitive share and pricing power shift"],
        marketImplication: "Policy can redirect semiconductor value across the stack rather than simply reduce total demand.",
      },
    ],
    concepts: [
      { name: "Inference", definition: "Running a trained AI model to answer requests or generate outputs.", whyHere: "Inference volume is the recurring workload that can turn cheap models into large compute demand." },
      { name: "HBM", definition: "High-bandwidth memory stacked close to accelerators to feed data at very high speed.", whyHere: "AI chips can be underutilised if memory bandwidth is insufficient, making HBM a critical bottleneck." },
      { name: "Accelerator", definition: "A specialised processor such as a GPU or AI ASIC used for training and inference.", whyHere: "Accelerator availability is a core constraint in the compute race." },
      { name: "ROIC", definition: "Return on invested capital: operating profit generated relative to capital committed.", whyHere: "The AI buildout increasingly needs to prove that huge capex produces acceptable returns." },
      { name: "Export controls", definition: "Government restrictions on the sale or transfer of strategic technology.", whyHere: "They influence access to advanced chips, equipment and the speed of domestic substitution." },
    ],
    counterfactual: "The current industrial-competition thesis would weaken if model costs stopped falling, AI usage failed to scale, localisation stalled and hyperscaler returns comfortably outran financing and infrastructure costs.",
    affectedMarkets: ["NVDA", "MU", "BABA", "SMIC", "CXMT", "Semis", "Cloud", "Power", "Credit"],
    subgroups: [
      { key: "models", label: "Models / Price War", accent: "blue", whyItMatters: "Cheaper intelligence can expand usage while compressing model economics.", mechanism: "Model price / quality → adoption → inference volume → monetisation." },
      { key: "chips", label: "Chips / Accelerators", accent: "purple", whyItMatters: "Accelerator access remains a strategic compute bottleneck.", mechanism: "Model demand → accelerator demand → supply / export controls → compute capacity." },
      { key: "memory", label: "Memory / HBM", accent: "orange", whyItMatters: "Memory bandwidth can constrain useful AI compute even when accelerators are available.", mechanism: "Inference / training → bandwidth demand → HBM capacity / pricing → system throughput." },
      { key: "cloud-inference", label: "Cloud / Inference", accent: "green", whyItMatters: "Inference economics determine whether falling model prices create profitable volume.", mechanism: "Usage → inference load → cloud utilisation → unit economics." },
      { key: "power", label: "Power / Data Centres", accent: "yellow", whyItMatters: "Power, cooling and grid access can become the physical limit to AI deployment.", mechanism: "Compute buildout → data centres → electricity / grid / cooling → project timing." },
      { key: "financing", label: "Financing / ROIC", accent: "red", whyItMatters: "The buildout depends on the return earned on very large, increasingly financed capex.", mechanism: "Capex + borrowing cost → cash conversion / ROIC → project pace and equity valuation." },
      { key: "policy", label: "Export Controls / Policy", accent: "teal", whyItMatters: "Industrial policy can reshape access to chips, equipment and strategic inputs.", mechanism: "Export controls / subsidies → supply access → localisation → competitive position." },
    ],
  },
  {
    slug: "energy-security-inflation",
    title: "Global Energy Security & Inflation",
    shortTitle: "Energy Security",
    coreQuestion: "Is marginal energy supply becoming structurally more expensive, fragile or politically constrained, and is that feeding inflation and rates?",
    whyItMatters: "Crude, products, LNG, shipping and power can transmit physical disruption into inflation, margins and central-bank policy.",
    mechanism: "Physical disruption → energy / freight cost → inflation and margins → central-bank room → yields / equities.",
    mechanismChains: [
      {
        label: "Chokepoint disruption → delivered energy inflation",
        steps: ["Security / transit risk ↑", "Physical flows or insurance capacity ↓", "Freight + delivered energy cost ↑", "Industrial / transport input costs ↑", "Inflation pressure and margin squeeze ↑"],
        marketImplication: "The inflation impulse depends on delivered fuel and freight costs, not crude alone.",
      },
      {
        label: "Refining bottleneck → diesel squeeze",
        steps: ["Refinery throughput / product supply ↓", "Distillate inventories tighten", "Crack spreads ↑", "Retail diesel / transport costs ↑", "PPI/CPI and corporate margins face pressure"],
        marketImplication: "Products can stay inflationary even when headline crude falls.",
      },
      {
        label: "LNG shock → electricity / industrial pressure",
        steps: ["Qatar / global LNG flows ↓", "Europe and Asia compete for flexible cargoes", "TTF / JKM ↑", "Electricity and industrial gas cost ↑", "Growth weakens while inflation pressure persists"],
        marketImplication: "Gas disruption can create a stagflationary impulse outside the oil market.",
      },
    ],
    concepts: [
      { name: "Crack spread", definition: "The margin proxy between refined-product prices and crude input cost.", whyHere: "A widening diesel crack can reveal product scarcity hidden by softer crude." },
      { name: "PADD", definition: "US Petroleum Administration for Defense District used to track regional refining and inventories.", whyHere: "Regional outages can create product stress even when national averages look less severe." },
      { name: "TTF / JKM", definition: "Major European and Asian natural-gas/LNG price benchmarks.", whyHere: "They show whether regions are competing aggressively for marginal LNG cargoes." },
      { name: "Chokepoint", definition: "A narrow transport route whose disruption can constrain large commodity flows.", whyHere: "Hormuz-type disruptions affect physical availability, freight and insurance simultaneously." },
    ],
    counterfactual: "The Regime would cool if physical flows normalised, refinery/product inventories rebuilt, LNG competition eased and energy stopped feeding inflation expectations or central-bank pricing.",
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
    mechanismChains: [
      {
        label: "Reserve diversification → structural gold demand",
        steps: ["Geopolitical / sanctions / reserve-security concern ↑", "Desire to diversify reserve assets ↑", "Central-bank gold allocation ↑", "Official-sector demand becomes persistent", "Structural support for gold ↑"],
        marketImplication: "Official demand can support gold even when short-term investor flows are weak.",
      },
      {
        label: "Real yields → cyclical gold pressure",
        steps: ["Real yields ↑", "Opportunity cost of holding non-yielding gold ↑", "USD can strengthen / financial conditions tighten", "Private investor demand can soften", "Gold faces cyclical headwind"],
        marketImplication: "Structural and cyclical gold forces can point in opposite directions at the same time.",
      },
    ],
    concepts: [
      { name: "Reserve diversification", definition: "Reducing reliance on one reserve asset or currency by allocating across alternatives.", whyHere: "It is the core structural mechanism behind official gold demand." },
      { name: "Opportunity cost", definition: "The return forgone by holding one asset instead of another.", whyHere: "Gold pays no coupon, so higher real bond yields increase the cost of holding it." },
      { name: "Official-sector demand", definition: "Purchases by central banks and reserve managers rather than private investors.", whyHere: "It can behave differently from ETF, futures or retail flows." },
      { name: "Real yield", definition: "Bond yield after expected inflation.", whyHere: "It is one of the cleanest cyclical macro inputs for gold." },
    ],
    counterfactual: "The structural thesis would weaken if official-sector purchases slowed materially and reserve diversification reversed; the cyclical headwind would ease if real yields and the dollar fell.",
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
    mechanismChains: [
      {
        label: "Earnings breadth → durable participation",
        steps: ["Revenue / margin guidance improves beyond megacap AI", "Forward EPS revisions broaden", "More sectors participate", "Equal-weight and small-cap relative strength improves", "Index rally becomes less concentrated"],
        marketImplication: "A broader earnings engine makes the rally less dependent on a few leaders.",
      },
      {
        label: "Rates → valuation quality test",
        steps: ["Real yields / cost of capital ↑", "Long-duration valuation hurdle ↑", "High-multiple leaders become more rate-sensitive", "Breadth and financials must absorb leadership", "Rally quality depends more on earnings than multiple expansion"],
        marketImplication: "Strong indices can conceal deteriorating quality if breadth fails while rates stay high.",
      },
    ],
    concepts: [
      { name: "Market breadth", definition: "How widely gains or losses are distributed across stocks and sectors.", whyHere: "It distinguishes a broad advance from an index carried by a small group." },
      { name: "Equal weight", definition: "An index construction that gives each member similar weight rather than weighting by market value.", whyHere: "RSP versus SPY is a simple test of whether gains extend beyond the largest companies." },
      { name: "Earnings revisions", definition: "Changes analysts make to expected future company profits.", whyHere: "Broad upward revisions provide fundamental support for broader participation." },
      { name: "Discount rate", definition: "The required return used to value future cash flows today.", whyHere: "Higher rates reduce the present value of distant earnings, especially for long-duration growth stocks." },
    ],
    counterfactual: "The concentration concern would weaken if forward earnings revisions, equal-weight performance, small caps and financials broadened while credit stayed healthy; it would strengthen if index gains persisted without those confirmations.",
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
  { regime: "global-cost-of-capital", subgroup: "global-rates", pattern: /\b(jgb|boj|japan|yen|carry trade|global yield|repatriat)\b/i, weight: 5 },
  { regime: "global-cost-of-capital", subgroup: "credit-financing", pattern: /\b(credit|spread|refinanc|funding|bond issuance|project finance|leverage|debt-funded)\b/i, weight: 5 },
  { regime: "global-cost-of-capital", subgroup: "housing", pattern: /\b(housing|mortgage|homebuilder|home sales|affordability)\b/i, weight: 5 },

  { regime: "us-china-ai", subgroup: "models", pattern: /\b(deepseek|qwen|glm|minimax|model price|token price|open[- ]source ai|ai model|inference price)\b/i, weight: 6 },
  { regime: "us-china-ai", subgroup: "chips", pattern: /\b(nvidia|nvda|ascend|accelerator|gpu|smic|ai chip|semiconductor)\b/i, weight: 5 },
  { regime: "us-china-ai", subgroup: "memory", pattern: /\b(hbm|high bandwidth memory|dram|cxmt|micron|sk hynix|memory chip)\b/i, weight: 6 },
  { regime: "us-china-ai", subgroup: "cloud-inference", pattern: /\b(inference|cloud|api price|token cost|ai usage|ai adoption)\b/i, weight: 4 },
  { regime: "us-china-ai", subgroup: "power", pattern: /\b(data cent(?:er|re)|power grid|electricity|cooling|ai infrastructure)\b/i, weight: 5 },
  { regime: "us-china-ai", subgroup: "financing", pattern: /\b(ai financ|ai capex|hyperscaler capex|ai debt|return on capital|roic|cash conversion)\b/i, weight: 6 },
  { regime: "us-china-ai", subgroup: "policy", pattern: /\b(export control|chip ban|industrial policy|subsid|entity list|technology restriction)\b/i, weight: 5 },

  { regime: "energy-security-inflation", subgroup: "crude", pattern: /\b(wti|brent|crude|oil supply|opec|oil price)\b/i, weight: 5 },
  { regime: "energy-security-inflation", subgroup: "products", pattern: /\b(diesel|ulsd|gasoline|refin|distillate|crack spread|padd)\b/i, weight: 6 },
  { regime: "energy-security-inflation", subgroup: "lng", pattern: /\b(lng|natural gas|qatar gas|ttf|jkm)\b/i, weight: 6 },
  { regime: "energy-security-inflation", subgroup: "shipping", pattern: /\b(hormuz|shipping|freight|insurance|tanker|chokepoint|vessel)\b/i, weight: 6 },
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
    const allNodes = subgroups.flatMap((subgroup) => subgroup.nodes)
      .sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || ""));
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
        ...subgroups.map((subgroup) => subgroup.latestAt),
      ]),
      stories: regimeStories,
      durableStories: durableRegimeStories,
      contextStories: contextRegimeStories,
      latestNode: allNodes[0] || null,
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
