import { describePublicEvidenceClaim, type PublicEvidenceClock } from "./blue-desk-evidence-preview.ts";

/**
 * Editorial display only. Never changes exact publisher source strings,
 * immutable Evidence, or a frozen Story's interpretation state.
 * This helper only rewrites a literal numeric source claim into its observed
 * cash-flow equation; it cannot invent stock moves or AI-specific causality.
 */
export type ReadableCashflowLead = { headline:string; deck:string };
const SEC_CASHFLOW_SOURCE = /^https:\/\/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK\d{10}\.json$/;

export function readableSecCashflowLead(
  claimText:string,
  context:PublicEvidenceClock,
):ReadableCashflowLead|null {
  if(context.sourceName!=="U.S. Securities and Exchange Commission"
     || !SEC_CASHFLOW_SOURCE.test(context.sourceUrl||""))return null;
  const asOf=Date.parse(context.editionAsOf||"");
  const knownAt=Date.parse(context.availableAt||"");
  if(!Number.isFinite(asOf)||!Number.isFinite(knownAt)||knownAt>asOf)return null;
  const p=describePublicEvidenceClaim(claimText,context);
  if(p.kind!=="SEC_CASHFLOW"||p.facts.length!==3)return null;
  const numbers=p.facts.map(f=>Number(f.value));
  if(!numbers.every(Number.isSafeInteger)||numbers[0]-numbers[1]!==numbers[2])return null;
  const match=/^(.{3,80}?) consolidated FY(20\d{2}) Q([1-4]) CFO /.exec(claimText.trim());
  if(!match)return null;
  const company=match[1].replace(/,\s*(?:Inc\.?|Corporation)$/i,"");
  const relation=numbers[1]>numbers[0]?"Cash PP&E exceeds operating cash flow":
    numbers[1]<numbers[0]?"Operating cash flow exceeds cash PP&E":
    "Cash PP&E equals operating cash flow";
  return {
    headline:company+" Q"+match[3]+" "+match[2]+": "+relation,
    deck:p.facts[0].valueLabel+" SEC-derived CFO; "+p.facts[1].valueLabel+
      " cash PP&E; simple FCF "+p.facts[2].valueLabel+
      " excluding finance-lease principal. This is not issuer-reported FCF.",
  };
}

export type ArticleSourceObservation = {
  claimText:string;sourceName:string;sourceUrl:string;availableAt:string|null;
};
export function readableSourceArticleLead(
  rawTitle:string,
  claims:readonly ArticleSourceObservation[],
  asOf:string,
):ReadableCashflowLead|null {
  for(const c of claims){
    // Only a literal raw source observation used as the article title
    // may be condensed; a genuine editorial headline is left untouched.
    if(!rawTitle.startsWith(c.claimText.slice(0,48)))continue;
    const display=readableSecCashflowLead(c.claimText,{
      sourceName:c.sourceName,sourceUrl:c.sourceUrl,
      availableAt:c.availableAt,editionAsOf:asOf,
    });
    if(display)return display;
  }
  return null;
}
