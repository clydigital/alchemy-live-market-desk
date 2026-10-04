import type { RegimeSlug } from "./regimes.ts";

export type RegimeMechanismChain = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
};

export type RegimeConcept = {
  key: string;
  label: string;
  definition: string;
  whyItMatters: string;
  watch: string[];
};

export type RegimeExplanation = {
  plainEnglish: string;
  counterfactual: string;
  chains: RegimeMechanismChain[];
  concepts: RegimeConcept[];
};

const EXPLANATIONS: Record<RegimeSlug, RegimeExplanation> = {
  "global-cost-of-capital": {
    plainEnglish: "This Regime is the US-rate and global funding machine. The key question is no longer only where the Fed sets the front end, but what yield is required to clear sovereign supply and private capital demand — and whether that cost starts forcing refinancing, collateral or liquidity stress.",
    counterfactual: "The restrictive version weakens if long yields fall sustainably, Treasury absorption improves, term-premium pressure eases, credit and mortgage costs decline and stress fails to migrate from property/project finance into broad corporate credit or banks.",
    chains: [
      {
        id: "treasury-duration",
        title: "Treasury supply → marginal buyer → borrowing costs",
        summary: "Large financing needs matter through the yield required to persuade domestic and foreign investors to absorb the next unit of duration.",
        steps: [
          "Fiscal deficit / refinancing need keeps issuance high",
          "Domestic and foreign marginal buyers compare Treasury duration with competing assets",
          "Clearing yield / term premium rises when absorption requires more compensation",
          "Mortgage, corporate and project-finance costs rise",
          "Investment, housing and long-duration valuations face pressure",
        ],
      },
      {
        id: "long-end-divergence",
        title: "Soft growth + dovish Fed pricing + rising long yields",
        summary: "When labour or growth soften but the long end still rises, the market is signalling that the problem is not reducible to the next Fed decision.",
        steps: [
          "Labour / growth data soften",
          "Near-term Fed pricing becomes less hawkish",
          "Front-end pressure eases but the 10Y / 30Y remain high or rise",
          "Term premium, fiscal supply, inflation uncertainty or private capital competition become more important",
          "The long end keeps financial conditions restrictive despite a softer policy path",
        ],
      },
      {
        id: "credit-transmission",
        title: "Long yields → refinancing → forced selling",
        summary: "High yields become systemic only when borrowers or asset holders lose the ability to wait.",
        steps: [
          "Long yields / credit spreads keep refinancing expensive",
          "CRE, AI project finance and weaker private borrowers face maturity or collateral gaps",
          "Extensions, equity cushions and private credit absorb the first shock",
          "Non-accruals, redemptions, covenant pressure or bank provisions rise",
          "Forced sales and broad credit widening turn a valuation shock into financial transmission",
        ],
      },
      {
        id: "global-carry",
        title: "Japan / Europe / global yields → capital flows",
        summary: "US rates do not trade in isolation. JGB repatriation and European sovereign fragmentation can change the global demand for duration and dollars.",
        steps: [
          "JGB, OAT, gilt or other sovereign yields reprice",
          "Relative-yield, hedge and domestic-liability economics change",
          "Cross-border capital, carry and reserve allocation adjust",
          "US duration and FX demand change",
          "Long-end yields and global financial conditions can move",
        ],
      },
      {
        id: "us-confidence-tail",
        title: "UST yields ↑ + USD ↓ → confidence tail",
        summary: "The qualitatively different tail is a persistent rise in Treasury yields while the dollar loses the usual benefit of higher US rates.",
        steps: [
          "Treasury yields rise",
          "Auction / foreign-demand quality deteriorates",
          "DXY falls instead of strengthening",
          "Gold and alternative reserve demand can strengthen despite high real yields",
          "The regime shifts from global tightening toward a US-confidence / fiscal-risk problem",
        ],
      },
    ],
    concepts: [
      {
        key: "term-premium",
        label: "Term premium",
        definition: "The extra return investors may demand to hold a long-dated bond instead of repeatedly rolling short-dated bonds.",
        whyItMatters: "It helps explain why the 10Y/30Y can stay high even when the expected Fed path is becoming less hawkish.",
        watch: ["US 10Y / 30Y", "Treasury supply", "auction demand", "inflation uncertainty"],
      },
      {
        key: "real-yield",
        label: "Real yield",
        definition: "A nominal bond yield after subtracting expected inflation.",
        whyItMatters: "It is a cleaner measure of the real opportunity cost facing gold and long-duration assets.",
        watch: ["10Y TIPS yield", "breakevens", "DXY", "gold"],
      },
      {
        key: "treasury-buyback",
        label: "Treasury buyback",
        definition: "Treasury purchases outstanding securities, generally to support market liquidity or manage the debt stock.",
        whyItMatters: "A buyback can help liquidity in particular maturities, but it does not by itself erase the government's net financing need.",
        watch: ["buyback sizes", "coupon issuance", "bill share", "long-end yields"],
      },
      {
        key: "marginal-buyer",
        label: "Marginal Treasury buyer",
        definition: "The investor who must be persuaded to absorb the next unit of Treasury supply at the market-clearing yield.",
        whyItMatters: "Foreign ownership can fall without a buyers' strike if domestic investors absorb supply — but at a higher required yield.",
        watch: ["auction tails", "dealer take-down", "indirect bids", "TIC flows", "household / fund flows"],
      },
      {
        key: "forced-selling",
        label: "Forced selling",
        definition: "Asset sales caused by margin, collateral, redemption, covenant or funding pressure rather than a discretionary portfolio view.",
        whyItMatters: "High yields become much more dangerous when leveraged or liquidity-sensitive holders cannot simply wait for prices to recover.",
        watch: ["repo / basis stress", "fund redemptions", "bank funding", "private-credit gates", "forced CRE sales"],
      },
      {
        key: "rollover-risk",
        label: "Rollover / refinancing risk",
        definition: "The risk that maturing debt must be refinanced later at a materially higher interest cost.",
        whyItMatters: "The stress often appears at maturity even when the underlying asset has not yet suffered an economic default.",
        watch: ["maturity profile", "coupon reset", "refinancing proceeds", "principal paydown", "new equity"],
      },
      {
        key: "discount-rate",
        label: "Discount rate",
        definition: "The rate used to translate future cash flows into today's value.",
        whyItMatters: "Assets whose profits are expected far in the future are usually more sensitive to a rise in required returns.",
        watch: ["real yields", "credit spreads", "long-duration equities", "housing"],
      },
      {
        key: "confidence-tail",
        label: "US-confidence tail",
        definition: "A regime in which higher Treasury yields are no longer accompanied by a stronger dollar, suggesting concern about the US asset itself rather than ordinary relative-rate tightening.",
        whyItMatters: "In that tail, long Treasuries may fail as an equity hedge and gold can behave very differently from a normal high-real-yield regime.",
        watch: ["US10Y / US30Y", "DXY", "auction demand", "foreign flows", "gold"],
      },
    ],
  },

  "us-china-ai": {
    plainEnglish: "This Regime now tracks the full AI capital cycle: model demand, chips, memory, power, debt, private capital, monetisation and control. The central test is whether revenue and utilisation can compound faster than binding infrastructure costs and financing expense while safety and regulation remain manageable.",
    counterfactual: "The stress thesis weakens if AI revenue compounds faster than capex, utilisation stays high, free cash flow re-expands, AI-linked credit narrows, new projects need less parent support and safety rules add security spend without materially delaying deployment.",
    chains: [
      {
        id: "price-inference",
        title: "AI price ↓ → inference demand ↑",
        summary: "Cheaper intelligence can widen adoption and increase recurring inference workloads even while unit pricing falls.",
        steps: [
          "Model price / cost per useful task falls",
          "More users, software and agents adopt AI",
          "Inference volume rises",
          "Compute, networking and memory-bandwidth demand rises",
          "Data-centre power and cooling demand rises",
        ],
      },
      {
        id: "capital-monetisation",
        title: "AI demand → capex → monetisation → credit",
        summary: "The buildout only works if the revenue generated by the installed capital base grows faster than its fixed and financing costs.",
        steps: [
          "AI demand drives compute / power / data-centre capex",
          "Debt, SPVs, leases, customer prepayments and private capital fund the buildout",
          "Power, grid equipment and construction add physical cost and inflation pressure",
          "Revenue and utilisation must rise fast enough to cover depreciation and financing",
          "Safety / regulatory constraints can delay deployment while commitments remain",
          "Cash conversion and coverage determine whether project stress migrates to parent credit",
          "Credit spreads and parent guarantees reveal recourse migration",
          "Valuation depends on realised return, not capex alone",
        ],
      },
      {
        id: "private-capital-duration",
        title: "Private longer → delayed price discovery",
        summary: "Large AI companies can absorb years of growth and financing risk before the public market supplies a daily clearing price.",
        steps: [
          "Late-stage private funding allows companies to remain private at much larger scale",
          "Employees and early investors use tenders / secondaries instead of IPO liquidity",
          "Headline private marks can persist between transactions",
          "A weaker funding round or IPO reveals the new clearing valuation",
          "Fund marks and fundraising can then feed back into hiring and compute demand",
        ],
      },
      {
        id: "control-duration",
        title: "Capability → control risk → regulatory duration",
        summary: "Infrastructure obligations can last for decades while permission to train or deploy a frontier model can change much faster.",
        steps: [
          "Frontier capability and agent autonomy increase",
          "Security / control failures raise liability and governance pressure",
          "Labs add containment, evaluation or deployment gates",
          "Regulators can slow or condition frontier deployment",
          "Utilisation / monetisation may be delayed while leases, debt and compute commitments remain",
        ],
      },
      {
        id: "localisation",
        title: "Export controls → domestic AI stack",
        summary: "Restrictions can turn chips, memory and manufacturing equipment into strategic localisation targets.",
        steps: [
          "Access to leading foreign hardware is restricted",
          "Domestic substitution incentives rise",
          "Local accelerators, foundry capacity and memory investment rise",
          "Bottlenecks move to yield, bandwidth, software and equipment",
          "Competitive position depends on how quickly the domestic stack closes those gaps",
        ],
      },
    ],
    concepts: [
      {
        key: "inference",
        label: "Inference",
        definition: "Running a trained AI model to answer prompts, generate content or make decisions.",
        whyItMatters: "As AI is embedded into more products, inference can become the recurring workload that drives compute and power demand.",
        watch: ["tokens / requests", "cloud utilisation", "accelerator demand", "power load"],
      },
      {
        key: "training-v-inference",
        label: "Training vs inference",
        definition: "Training builds a model from data; inference runs that trained model in production.",
        whyItMatters: "The hardware mix, utilisation profile and economics can differ materially between the two workloads.",
        watch: ["training clusters", "inference demand", "utilisation", "model efficiency"],
      },
      {
        key: "ai-roic",
        label: "AI infrastructure ROIC",
        definition: "The return generated by AI infrastructure relative to the capital invested in it.",
        whyItMatters: "Very large capex can still destroy value if utilisation, pricing or monetisation cannot cover depreciation and financing costs.",
        watch: ["capex", "free cash flow", "utilisation", "AI revenue", "credit spreads"],
      },
      {
        key: "ai-monetisation-gap",
        label: "AI Monetisation Gap",
        definition: "The gap between growth in AI revenue / utilisation and growth in binding infrastructure and financing costs.",
        whyItMatters: "AI can generate real revenue and still destroy value if the capital base expands faster than cash returns.",
        watch: ["AI revenue", "free cash flow", "utilisation", "capex", "interest coverage", "credit spreads"],
      },
      {
        key: "recourse-migration",
        label: "Recourse migration",
        definition: "A financing shift in which risk that began inside a project or SPV requires more parent guarantees, equity support or direct balance-sheet funding.",
        whyItMatters: "It is a cleaner sign of deteriorating financing quality than the existence of an SPV itself.",
        watch: ["parent guarantees", "equity cushions", "advance rates", "DSCR", "loan tenor", "project spreads"],
      },
      {
        key: "regulatory-duration",
        label: "AI regulatory duration",
        definition: "The mismatch between long-lived infrastructure obligations and a safety or policy environment that can change much faster.",
        whyItMatters: "A data centre or compute contract can remain payable even if model deployment is delayed.",
        watch: ["training pauses", "deployment rules", "compute cancellations", "data-centre delays", "liability rules"],
      },
      {
        key: "private-price-discovery",
        label: "Private-market price discovery",
        definition: "Valuation discovery that occurs through funding rounds, tenders, secondaries or IPOs rather than continuous public trading.",
        whyItMatters: "Losses can look delayed until a transaction forces a new clearing price.",
        watch: ["tender prices", "secondary discounts", "down rounds", "IPO pricing", "fund NAV marks"],
      },
      {
        key: "hbm",
        label: "HBM",
        definition: "High Bandwidth Memory: stacked memory designed to move very large amounts of data quickly between memory and AI processors.",
        whyItMatters: "AI accelerators can be constrained by memory bandwidth, so HBM availability can determine usable system throughput.",
        watch: ["HBM capacity", "memory pricing", "packaging capacity", "accelerator shipments"],
      },
      {
        key: "export-controls",
        label: "Export controls",
        definition: "Rules restricting access to selected chips, manufacturing equipment, software or technical know-how.",
        whyItMatters: "They can change where bottlenecks sit and accelerate domestic substitution efforts.",
        watch: ["licence rules", "equipment restrictions", "domestic accelerator launches", "foundry progress"],
      },
    ],
  },

  "energy-security-inflation": {
    plainEnglish: "This Regime tracks how physical energy constraints become financial-market constraints. The important question is not only whether crude is high, but whether fuel, LNG, freight and electricity costs are feeding inflation and squeezing margins.",
    counterfactual: "The inflationary regime weakens if crude, refined products, LNG and freight normalise together, inventories rebuild and central banks can look through energy without broader inflation expectations rising.",
    chains: [
      {
        id: "physical-inflation",
        title: "Supply disruption → inflation → rates",
        summary: "A physical shock matters for markets when higher delivered energy costs spread beyond the commodity itself.",
        steps: [
          "Supply, chokepoint or geopolitical disruption occurs",
          "Delivered crude / LNG / product cost rises",
          "Freight, electricity and production costs rise",
          "CPI / PPI and inflation expectations face pressure",
          "Central-bank easing room falls and yields can rise",
        ],
      },
      {
        id: "refining-diesel",
        title: "Refining bottleneck → diesel inflation",
        summary: "Product markets can remain tight even when headline crude falls.",
        steps: [
          "Refinery throughput or usable capacity falls",
          "Distillate availability tightens",
          "Crack spreads and diesel prices rise",
          "Transport and industrial costs rise",
          "Margins and inflation-sensitive rates react",
        ],
      },
      {
        id: "lng-power",
        title: "LNG disruption → electricity / industrial margins",
        summary: "A major LNG supply loss can force Europe and Asia to compete for flexible Atlantic cargoes.",
        steps: [
          "LNG flows from a major producer or chokepoint fall",
          "Regional buyers compete for flexible cargoes",
          "TTF / JKM and delivered gas prices rise",
          "Electricity and industrial input costs rise",
          "Margins weaken and inflation / policy pressure can rise",
        ],
      },
    ],
    concepts: [
      {
        key: "crack-spread",
        label: "Crack spread",
        definition: "The margin proxy between the price of refined fuels and the crude oil used to make them.",
        whyItMatters: "A wide diesel crack can signal product scarcity even when crude prices are soft.",
        watch: ["ULSD cracks", "gasoline cracks", "refinery utilisation", "product inventories"],
      },
      {
        key: "distillates",
        label: "Distillates",
        definition: "Middle-distillate fuels such as diesel and heating oil.",
        whyItMatters: "They are heavily used in freight, industry and agriculture, so tightness can transmit widely through the economy.",
        watch: ["distillate stocks", "exports", "diesel prices", "PADD balances"],
      },
      {
        key: "lng-benchmarks",
        label: "TTF / JKM",
        definition: "Widely followed European and Asian natural-gas / LNG price benchmarks.",
        whyItMatters: "They reveal whether a regional supply shock is becoming global competition for flexible LNG cargoes.",
        watch: ["TTF", "JKM", "Atlantic LNG flows", "storage"],
      },
      {
        key: "chokepoint",
        label: "Chokepoint risk",
        definition: "The risk that a narrow shipping route constrains the physical movement of energy.",
        whyItMatters: "Even without permanent production loss, transit and insurance disruption can raise delivered prices.",
        watch: ["Hormuz / Red Sea flows", "war-risk insurance", "tanker rates", "rerouting"],
      },
    ],
  },

  "gold-reserve-diversification": {
    plainEnglish: "Gold has two overlapping engines: a structural monetary bid from reserve diversification and a cyclical macro trade driven by real yields and the dollar. Those forces can point in different directions at the same time.",
    counterfactual: "The structural case weakens if official-sector buying fades and reserve diversification reverses; the cyclical case weakens when real yields and the dollar rise enough to outweigh structural demand.",
    chains: [
      {
        id: "reserve-diversification",
        title: "Reserve risk → central-bank gold demand",
        summary: "Reserve managers may diversify when geopolitical, sanctions or sovereign risks change the perceived safety of existing reserve assets.",
        steps: [
          "Geopolitical / sanctions / sovereign-credibility concerns rise",
          "Reserve managers seek greater diversification",
          "Official-sector gold allocation rises",
          "Central-bank physical demand creates a structural bid",
          "Gold can remain supported even when private flows are mixed",
        ],
      },
      {
        id: "real-yield-gold",
        title: "Real yields → gold opportunity cost",
        summary: "Gold does not pay a coupon, so the return available on inflation-protected bonds changes the opportunity cost of holding it.",
        steps: [
          "Expected Fed / inflation path changes",
          "Real yields move",
          "Opportunity cost of non-yielding gold changes",
          "USD and investor positioning respond",
          "Cyclical gold demand strengthens or weakens",
        ],
      },
      {
        id: "private-flows",
        title: "Macro narrative → ETF / futures flows",
        summary: "Private investors can amplify or offset official-sector demand over shorter horizons.",
        steps: [
          "Macro / geopolitical narrative changes",
          "Investor positioning and momentum change",
          "ETF / futures flows adjust",
          "Marginal financial demand changes",
          "Gold price can diverge from structural official demand temporarily",
        ],
      },
    ],
    concepts: [
      {
        key: "reserve-diversification",
        label: "Reserve diversification",
        definition: "Changing the mix of assets held by a central bank or sovereign reserve manager.",
        whyItMatters: "Gold demand can rise for portfolio-resilience reasons that are separate from short-term Fed trading.",
        watch: ["central-bank purchases", "reserve composition", "sanctions policy", "FX reserves"],
      },
      {
        key: "official-sector",
        label: "Official-sector demand",
        definition: "Purchases made by central banks and other official reserve institutions.",
        whyItMatters: "It can be slower-moving and less price-sensitive than many speculative flows.",
        watch: ["World Gold Council / official data", "central-bank reserves", "physical flows"],
      },
      {
        key: "gold-opportunity-cost",
        label: "Opportunity cost",
        definition: "The return forgone by holding one asset instead of another.",
        whyItMatters: "When real safe yields rise, holding non-yielding gold becomes relatively more expensive.",
        watch: ["real yields", "DXY", "Fed path", "gold"],
      },
    ],
  },

  "equity-rally-quality": {
    plainEnglish: "This Regime asks whether an equity rally is supported by broad earnings and participation or is being carried by a narrow group of expensive leaders. Index strength and market health are not always the same thing.",
    counterfactual: "A narrow rally becomes healthier if earnings revisions improve outside the leaders, equal-weight and smaller companies participate, financials confirm credit transmission and valuation pressure from real yields eases.",
    chains: [
      {
        id: "earnings-breadth",
        title: "Earnings revisions → participation",
        summary: "A durable rally usually needs improving profits across more than a handful of companies.",
        steps: [
          "Revenue / margin expectations change",
          "Forward earnings revisions change",
          "Sector and company leadership broadens or narrows",
          "Equal-weight / small-cap participation responds",
          "Index rally quality improves or deteriorates",
        ],
      },
      {
        id: "rates-valuations",
        title: "Real yields → equity multiples",
        summary: "Higher required returns can compress valuations even when nominal earnings are still growing.",
        steps: [
          "Real yields / cost of capital rise",
          "Discount rates applied to future cash flows rise",
          "Long-duration equity multiples face pressure",
          "Leadership may narrow toward companies with stronger near-term cash generation",
          "Index breadth can weaken",
        ],
      },
      {
        id: "financials-credit",
        title: "Financials → domestic-cycle confirmation",
        summary: "Banks connect the yield curve, loan demand and credit creation to the real economy.",
        steps: [
          "Curve / funding / credit conditions change",
          "Bank margins and lending appetite change",
          "Credit creation and domestic activity respond",
          "Cyclical earnings breadth changes",
          "Financial-sector relative performance confirms or contradicts the rally",
        ],
      },
    ],
    concepts: [
      {
        key: "market-breadth",
        label: "Market breadth",
        definition: "How widely gains or losses are distributed across stocks rather than concentrated in the index's largest members.",
        whyItMatters: "A strong index can hide weak participation underneath.",
        watch: ["advance/decline", "% above 50D", "new highs/lows", "RSP/SPY"],
      },
      {
        key: "equal-weight",
        label: "Equal-weight index",
        definition: "An index that gives each constituent a similar weight instead of letting the largest companies dominate.",
        whyItMatters: "Comparing equal-weight with cap-weighted indices helps reveal concentration.",
        watch: ["RSP/SPY", "sector breadth", "small caps"],
      },
      {
        key: "earnings-revisions",
        label: "Earnings revisions",
        definition: "Changes in analysts' forward profit estimates.",
        whyItMatters: "Price gains supported by rising earnings expectations are different from gains driven mainly by multiple expansion.",
        watch: ["forward EPS", "revision breadth", "guidance", "margins"],
      },
      {
        key: "duration-equity",
        label: "Long-duration equity",
        definition: "A stock whose valuation depends heavily on cash flows expected far in the future.",
        whyItMatters: "Those valuations are generally more sensitive to rising real yields and discount rates.",
        watch: ["real yields", "growth multiples", "free cash flow", "AI capex"],
      },
    ],
  },
};

export function getRegimeExplanation(slug: string): RegimeExplanation | null {
  return slug in EXPLANATIONS ? EXPLANATIONS[slug as RegimeSlug] : null;
}
