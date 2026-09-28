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
    plainEnglish: "This Regime is about the price of money. When governments, companies and households have to pay more to borrow for longer, that cost flows into mortgages, corporate projects, equity valuations and eventually economic activity.",
    counterfactual: "The restrictive version weakens if inflation cools convincingly, Treasury supply is absorbed without a rising term premium, real yields fall and credit/housing borrowing costs ease at the same time.",
    chains: [
      {
        id: "treasury-duration",
        title: "Treasury supply → economy-wide borrowing costs",
        summary: "Large financing needs matter most when investors demand more compensation to hold additional duration.",
        steps: [
          "Fiscal deficit / refinancing need rises",
          "Treasury bill and coupon supply must be absorbed",
          "Term premium and long-end yields can rise if demand is insufficient",
          "Mortgage and corporate borrowing costs rise",
          "Investment, housing activity and long-duration valuations face pressure",
        ],
      },
      {
        id: "fed-real-yields",
        title: "Inflation / growth → Fed path → real yields",
        summary: "The front end prices near-term policy; real yields then transmit policy expectations into financial conditions.",
        steps: [
          "Growth or inflation expectations change",
          "Expected Fed path and front-end yields reprice",
          "Real yields and the dollar respond",
          "Financing and discount rates change",
          "Equities, gold, housing and credit reprice",
        ],
      },
      {
        id: "global-carry",
        title: "Japan / global yields → capital flows",
        summary: "US rates do not trade in isolation. Higher foreign yields can change hedging, repatriation and carry economics.",
        steps: [
          "JGB or other global sovereign yields change",
          "Relative yield / hedge economics change",
          "Cross-border capital and carry positions adjust",
          "US duration and FX demand change",
          "Long-end yields and global financial conditions can move",
        ],
      },
    ],
    concepts: [
      {
        key: "term-premium",
        label: "Term premium",
        definition: "The extra return investors may demand to hold a long-dated bond instead of repeatedly rolling short-dated bonds.",
        whyItMatters: "It helps explain why the 10Y/30Y can stay high even when the expected Fed path is not becoming more hawkish.",
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
        key: "rollover-risk",
        label: "Rollover / refinancing risk",
        definition: "The risk that maturing debt must be refinanced later at a materially higher interest cost.",
        whyItMatters: "Shortening maturity can reduce duration supplied today while increasing sensitivity to future short rates.",
        watch: ["maturity profile", "bill share", "average interest cost", "net interest outlays"],
      },
      {
        key: "discount-rate",
        label: "Discount rate",
        definition: "The rate used to translate future cash flows into today's value.",
        whyItMatters: "Assets whose profits are expected far in the future are usually more sensitive to a rise in required returns.",
        watch: ["real yields", "credit spreads", "long-duration equities", "housing"],
      },
    ],
  },

  "us-china-ai": {
    plainEnglish: "This Regime asks where AI value ends up as model intelligence becomes cheaper. Falling model prices can expand usage and physical compute demand while simultaneously making it harder for model providers and infrastructure investors to earn attractive returns.",
    counterfactual: "The tension eases if cheaper models expand usage without compressing monetisation, infrastructure utilisation stays high, hardware bottlenecks loosen and returns on AI capex remain comfortably above financing costs.",
    chains: [
      {
        id: "price-inference",
        title: "AI price ↓ → inference demand ↑",
        summary: "Cheaper intelligence can widen adoption and increase the number of model calls made across software and agents.",
        steps: [
          "Model price / cost per useful task falls",
          "More users and applications adopt AI",
          "Inference volume rises",
          "Compute, networking and memory bandwidth demand rises",
          "Data-centre power and cooling demand rises",
        ],
      },
      {
        id: "monetisation-roic",
        title: "Price competition → monetisation → ROIC",
        summary: "Higher usage is not automatically higher economic value if revenue per unit falls faster than utilisation improves.",
        steps: [
          "Revenue per token / task faces pressure",
          "Model and cloud gross-margin economics change",
          "Cash conversion and infrastructure ROIC are tested",
          "Debt / equity financing becomes more important",
          "Capex pace and valuations depend on realised returns",
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
        key: "hbm",
        label: "HBM",
        definition: "High Bandwidth Memory: stacked memory designed to move very large amounts of data quickly between memory and AI processors.",
        whyItMatters: "AI accelerators can be constrained by memory bandwidth, so HBM availability can determine usable system throughput.",
        watch: ["HBM capacity", "memory pricing", "packaging capacity", "accelerator shipments"],
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
