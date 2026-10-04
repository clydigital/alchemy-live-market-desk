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
    { id: "ai-monetisation-watch", level: "WATCH", label: "Revenue vs binding infrastructure cost", condition: "AI revenue growth slows relative to capex, leases, compute commitments or financing expense.", whyItMatters: "The buildout can be economically stressed even while AI demand and headline revenue remain large.", scenarioEffect: "Keeps the AI Monetisation Gap in Scenario B watch.", evidenceRequirement: "Current revenue, capex, binding commitments and financing-cost evidence." },
    { id: "ai-credit-spread", level: "ACCELERATION", label: "AI credit repricing", condition: "AI-linked IG approaches roughly 150 bp while broader IG remains materially tighter.", whyItMatters: "Sector-specific spread widening indicates the market is demanding more compensation for AI financing / ROI risk.", scenarioEffect: "Raises A → B probability.", evidenceRequirement: "Comparable, current AI-linked and broad IG spread observations." },
    { id: "recourse-migration", level: "ACCELERATION", label: "Recourse migration", condition: "New AI projects require stronger parent guarantees, larger equity cushions, lower advance rates, higher DSCRs or shorter maturities than earlier structures.", whyItMatters: "It shows project-level risk migrating toward parent balance sheets before an outright default occurs.", scenarioEffect: "Raises B probability and can become a bridge toward C.", evidenceRequirement: "Contract-level financing terms from current filings / credible transaction reporting." },
    { id: "coverage-warning", level: "ACCELERATION", label: "Levered AI coverage approaches 1.5x", condition: "A CoreWeave-style borrower approaches roughly 1.5x interest coverage on realised or transparently modelled inputs.", whyItMatters: "The cushion against utilisation or refinancing shocks is becoming thin.", scenarioEffect: "Supports stronger Scenario B; near 1.0x becomes a severe recapitalisation / restructuring warning.", evidenceRequirement: "Canonical borrower financials; any modelled stress must remain labelled reasoning, not evidence." },
    { id: "control-delay", level: "ACCELERATION", label: "Control / regulation changes physical demand", condition: "Safety or regulatory restrictions cause actual compute-order cancellations, model-release delays with material utilisation impact, or data-centre project delays.", whyItMatters: "The control clock is directly slowing monetisation while long-lived commitments remain.", scenarioEffect: "Raises B and can reduce later inflation / duration pressure.", evidenceRequirement: "Verified corporate / regulatory action linked to actual project or capacity changes." },
  ],
};

export function getDossierTriggerDefinitions(slug: RegimeSlug): DossierTriggerDefinition[] {
  return TRIGGERS[slug] ?? [];
}
