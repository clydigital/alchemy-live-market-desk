import type { RegimeSlug } from "./regimes";

export type DossierTriggerLevel =
  | "ACTIVE"
  | "WATCH"
  | "ACCELERATION"
  | "CREDIT_TRANSMISSION"
  | "SYSTEMIC"
  | "US_CONFIDENCE_TAIL";

export type DossierTriggerDefinition = {
  id: string;
  level: DossierTriggerLevel;
  label: string;
  condition: string;
  whyItMatters: string;
  scenarioEffect: string;
  evidenceRequirement: string;
  /** Research watch hypothesis, NOT a measured live status. */
  quantitativeTest?: string;
  bullishFalsifier?: string;
  missingEvidence?: string;
};

const TRIGGERS: Partial<Record<RegimeSlug, DossierTriggerDefinition[]>> = {
  "global-cost-of-capital": [
    { id: "labour-rates-divergence", level: "ACTIVE", label: "Labour soft + dovish Fed pricing + long yields still rising", condition: "Labour / growth softens and near-term Fed pricing becomes less hawkish while the 10Y/30Y remain high or rise.", whyItMatters: "It separates a long-end term-premium / supply problem from a simple next-Fed-meeting trade.", scenarioEffect: "Raises A → B probability when confirmed by canonical rates evidence.", evidenceRequirement: "Timestamped labour data, policy-pricing evidence and long-end yield observations." },
    { id: "france-fragmentation", level: "ACTIVE", label: "France fragmentation threshold", condition: "France–Germany 10Y spread is above 150 bp; 175–200 bp is the next escalation zone.", whyItMatters: "A wider sovereign spread can transmit through euro-area banks, fiscal credibility and ECB fragmentation risk.", scenarioEffect: "Keeps Global Sovereign Stress awake; 175–200 bp supports escalation.", evidenceRequirement: "Current OAT and Bund yields / spread from canonical market evidence." },
    { id: "cre-credit-acceleration", level: "ACCELERATION", label: "CRE / private-credit transmission", condition: "Total CMBS delinquency approaches 9–10%, multifamily reaches double digits, or bank / private-credit loss metrics deteriorate materially.", whyItMatters: "The stress is moving from property-level refinancing into lenders and balance sheets.", scenarioEffect: "Moves B toward C if accompanied by wider corporate credit.", evidenceRequirement: "Current CMBS, bank and private-credit realised metrics." },
    { id: "broad-credit-transmission", level: "CREDIT_TRANSMISSION", label: "Broad corporate credit confirms contagion", condition: "Broad IG is above roughly 150 bp and BB / HY is above roughly 400 bp, or equivalent bank / CRE spillover is evident.", whyItMatters: "This is the point where sector stress is no longer contained inside property, project or lower-quality private credit.", scenarioEffect: "Material B → C shift.", evidenceRequirement: "Canonical broad-credit spreads plus realised bank / funding evidence." },
    { id: "forced-selling", level: "SYSTEMIC", label: "Forced deleveraging", condition: "Funding, redemption, collateral or covenant pressure forces cross-institution asset sales.", whyItMatters: "Leverage plus liquidity / maturity mismatch turns mark-to-market losses into a self-reinforcing feedback loop.", scenarioEffect: "Moves C → D.", evidenceRequirement: "Observed forced sales, margin / collateral calls, gates, funding stress or emergency liquidity." },
    { id: "us-confidence", level: "US_CONFIDENCE_TAIL", label: "UST yields ↑ while USD ↓", condition: "Treasury yields rise persistently while DXY falls and auction / foreign-demand quality deteriorates.", whyItMatters: "This is qualitatively different from ordinary high-yield / strong-dollar tightening and can make Treasuries fail as the normal equity hedge.", scenarioEffect: "Directly raises Scenario E probability.", evidenceRequirement: "Timestamped UST yields, DXY, auction quality and foreign / domestic demand evidence." },
  ],
  "us-china-ai": [
    {
      id: "ai-capex-cash-coverage",
      level: "WATCH",
      label: "AI spend outruns internally generated cash",
      condition: "Capex / operating cash flow exceeds 1.0x for two consecutive quarters; >1.5x with falling net liquidity or rising debt is escalation. Negative CFO makes the ratio not meaningful.",
      whyItMatters: "A builder may depend increasingly on outside capital despite positive headline AI revenue growth.",
      scenarioEffect: "Research watch first; reconsider the financing subgroup only after independent cash-flow and funding confirmation.",
      evidenceRequirement: "Exact issuer SEC/IR quarterly CFO and capex; debt, cash, lease obligations and consistent YoY/QoQ windows.",
      quantitativeTest: "Watch: capex/CFO > 1.0x for 2Q. Escalation: >1.5x for 2Q AND net liquidity declines or net borrowing rises.",
      bullishFalsifier: "Ratio declines and cash conversion improves while paid cloud/AI usage and margins still increase.",
      missingEvidence: "If CFO <= 0, missing segment capex, or mismatched fiscal periods: UNRESOLVED; do not score a numeric ratio.",
    },
    {
      id: "ai-supplier-customer-order-chain",
      level: "ACCELERATION",
      label: "Supply-chain slowdown reaches named customers",
      condition: "Supplier book-to-bill falls below 1.0 for two quarters AND a disclosed major customer cuts comparable procurement/capex guidance >=10%. Backlog declines alone can mean fulfilled orders.",
      whyItMatters: "Tests whether chip, HBM, power or equipment slowdown is transmitted into a paying customer's demand, rather than merely a stock-price rotation.",
      scenarioEffect: "Strengthens AI demand-risk investigation; does not automatically downgrade a distinct customer Story.",
      evidenceRequirement: "Named supplier-to-customer linkage, confirmed contractual exposure, supplier order intake and customer guidance on comparable reporting periods.",
      quantitativeTest: "Watch: supplier book-to-bill <1.0 for 2Q plus customer capex/procurement guidance cut >=10%; escalation requires actual cancellation or second supplier confirmation.",
      bullishFalsifier: "Backlog conversion to shipment increases, customer guidance holds, and paid utilisation/revenue continues higher.",
      missingEvidence: "Without confirmed customer identity, report SECTOR CORRELATION only, not a customer-specific failure.",
    },
    {
      id: "ai-earnings-valuation-bridge",
      level: "WATCH",
      label: "Forward profits fail to justify the valuation",
      condition: "Next-12-month consensus EPS revised down >=5% in 30 days while forward P/E remains >=25% above that issuer's own five-year median.",
      whyItMatters: "Separates an expensive stock with improving expected profits from expensive shares whose earnings support is deteriorating.",
      scenarioEffect: "Flags valuation compression risk; require credit, margin or guidance transmission before any regime downgrade.",
      evidenceRequirement: "Dated forward consensus series, matching unadjusted/current price and P/E definition, issuer guidance and accounting normalisation.",
      quantitativeTest: "Watch: forward EPS estimate -5%/30d AND forward P/E >=1.25x own 5Y median; escalation: comparable issuer EBIT/EPS guidance cut >=10%.",
      bullishFalsifier: "Consensus profits and realised margin rise, and forward multiple compresses without a demand shock.",
      missingEvidence: "For non-positive earnings forward P/E is NOT APPLICABLE; use cash runway, gross profit, customer commitments and EV metrics.",
    },
    {
      id: "ai-equity-leadership-divergence",
      level: "WATCH",
      label: "AI semiconductor leadership breaks beneath the index",
      condition: "SMH trails QQQ by >=5 percentage points over a matched ten-session total-return window.",
      whyItMatters: "Markets can start discounting lower AI supplier returns before consolidated revenues actually decline.",
      scenarioEffect: "Prompts cross-check of earnings revisions, supply-chain orders and credit; price alone is not a completed Dossier thesis change.",
      evidenceRequirement: "Matched closing price/adjusted total returns for SMH and QQQ; semiconductor earnings revisions, broad and issuer credit observations.",
      quantitativeTest: "Watch: 10-session SMH minus QQQ <= -5pp; escalation: 20-session persistence PLUS negative supplier guidance or financing deterioration.",
      bullishFalsifier: "SMH-relative breadth and earnings revisions recover on matched windows.",
      missingEvidence: "No matched observations means coverage gap, not a negative return assumption.",
    },
    { id: "ai-monetisation-watch", level: "WATCH", label: "Revenue vs binding infrastructure cost", condition: "AI revenue growth slows relative to capex, leases, compute commitments or financing expense.", whyItMatters: "The buildout can be economically stressed even while AI demand and headline revenue remain large.", scenarioEffect: "Keeps the AI Monetisation Gap in Scenario B watch.", evidenceRequirement: "Current revenue, capex, binding commitments and financing-cost evidence." },
    { id: "ai-credit-spread", level: "ACCELERATION", label: "AI credit repricing", condition: "AI-linked IG approaches roughly 150 bp while broader IG remains materially tighter.", whyItMatters: "Sector-specific spread widening indicates the market is demanding more compensation for AI financing / ROI risk.", scenarioEffect: "Raises A → B probability.", evidenceRequirement: "Comparable, current AI-linked and broad IG spread observations." },
    { id: "recourse-migration", level: "ACCELERATION", label: "Recourse migration", condition: "New AI projects require stronger parent guarantees, larger equity cushions, lower advance rates, higher DSCRs or shorter maturities than earlier structures.", whyItMatters: "It shows project-level risk migrating toward parent balance sheets before an outright default occurs.", scenarioEffect: "Raises B probability and can become a bridge toward C.", evidenceRequirement: "Contract-level financing terms from current filings / credible transaction reporting." },
    { id: "coverage-warning", level: "ACCELERATION", label: "Levered AI coverage approaches 1.5x", condition: "A CoreWeave-style borrower approaches roughly 1.5x interest coverage on realised or transparently modelled inputs.", whyItMatters: "The cushion against utilisation or refinancing shocks is becoming thin.", scenarioEffect: "Supports stronger Scenario B; near 1.0x becomes a severe recapitalisation / restructuring warning.", evidenceRequirement: "Canonical borrower financials; any modelled stress must remain labelled reasoning, not evidence." },
    { id: "control-delay", level: "ACCELERATION", label: "Control / regulation changes physical demand", condition: "Safety or regulatory restrictions cause actual compute-order cancellations, model-release delays with material utilisation impact, or data-centre project delays.", whyItMatters: "The control clock is directly slowing monetisation while long-lived commitments remain.", scenarioEffect: "Raises B and can reduce later inflation / duration pressure.", evidenceRequirement: "Verified corporate / regulatory action linked to actual project or capacity changes." },
  ],
  "equity-rally-quality": [
    {
      id: "xlf-relative-leadership",
      level: "WATCH",
      label: "Financials underperform broad equities",
      condition: "XLF underperforms SPY by >=5 percentage points over 20 matched trading sessions.",
      whyItMatters: "Possible early funding/loan-profit weakness masked by technology index concentration.",
      scenarioEffect: "Investigation watch; escalate only if bank loan losses or broad credit spreads confirm.",
      evidenceRequirement: "Matched total returns, bank reserves / provisions, delinquency reports and corporate spreads.",
      quantitativeTest: "Watch: 20-session XLF-SPY <= -5pp; escalation: plus HY OAS +50bp/20 sessions or deterioration in actual bank loss metrics.",
      bullishFalsifier: "XLF relative trend stabilises while matched bank credit measures and spreads remain resilient.",
      missingEvidence: "XLF relative performance alone cannot prove financial-system stress.",
    },
    {
      id: "rally-earnings-revisions",
      level: "ACCELERATION",
      label: "Index leadership no longer supported by revisions",
      condition: "High-multiple leaders sustain >5% negative forward EPS revisions over 30 days while relative sector breadth deteriorates on matched sessions.",
      whyItMatters: "Quantifies a price-versus-earnings expectations break before treating the rally as broadly impaired.",
      scenarioEffect: "Only strong issuer earnings guidance, breadth and credit confirmation can change the persistent Story.",
      evidenceRequirement: "Same-provider forward EPS snapshots, valuation median and matched SPY/RSP/QQQ/SMH comparisons.",
      quantitativeTest: "Earnings watch: forward EPS -5%/30 days AND forward P/E >1.25x issuer 5Y median; confirm with >=2 sectors or strong concentration exposure.",
      bullishFalsifier: "Revisions turn positive and RSP/SPY participation improves on comparable observations.",
      missingEvidence: "No dated forward estimates => UNRESOLVED; do not substitute creator forecasts.",
    },
  ],
};

export function getDossierTriggerDefinitions(slug: RegimeSlug): DossierTriggerDefinition[] {
  return TRIGGERS[slug] ?? [];
}
