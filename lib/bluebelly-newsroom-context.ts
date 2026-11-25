import type {EditorialRegimeId} from "./bluebelly-editorial-architecture.ts";
export type NewsroomContext={players:string;marketRelevance:string;research:readonly {lens:EditorialRegimeId;question:string}[]};
/** Editor-reviewed context for exact dated records, not inferred customers,
 * verified price causality, or a canonical thesis update. */
const CONTEXT:Record<string,NewsroomContext>={
 "xlk-critical-support-2026-11-25":{
  players:"XLK tracks S&P 500 technology companies. Nvidia sells AI chips; Oracle and CoreWeave provide computing capacity to customers. Their financing conditions matter to future infrastructure demand, rather than just Nvidia's leadership.",
  marketRelevance:"The technology reversal alongside gains in nine sectors points to possible rotation. Rising AI-linked credit risk could constrain investment. The $142.66 channel midpoint is an AlchemyMarkets technical watch level, not a guaranteed target.",
  research:[{lens:"ai",question:"Can AI buyers generate cash returns sufficient to sustain chip and infrastructure spending?"},{lens:"bonds",question:"Is AI issuer credit stress spreading to the wider corporate market?"},{lens:"breadth",question:"Does the rotation persist across matched sessions?"},{lens:"fed",question:"Does the PCE release and yield response ease financing pressure?"}]
 },
 "anthropic-ipo-pricing-debut-2026-11-19":{
  players:"Anthropic develops AI models. Its offering raises capital for the business, which needs computing infrastructure to develop and serve those models. Public investors are funding that expansion; the cited pricing does not identify new customer contracts.",
  marketRelevance:"More funding could support compute purchases and infrastructure demand. For investors, the key distinction is capital raised versus the cash the business can ultimately earn from customers.",
  research:[{lens:"ai",question:"Does demand generate sufficient cash returns to justify AI investment?"},{lens:"breadth",question:"Is appetite for AI stocks broadening or concentrated in a few names?"}]
 },
 "freddie-mac-mortgage-rate-2026-11-19":{
  players:"Freddie Mac's weekly survey tracks US mortgage borrowing costs. Homebuyers and borrowers renewing or refinancing loans are the directly exposed groups; this is not an individual lender's quote.",
  marketRelevance:"Higher mortgage costs can reduce affordability and housing demand, affecting builders and lenders. The survey measures a financing cost, not actual home sales or defaults.",
  research:[{lens:"housing",question:"Is expensive housing beginning to weaken demand or household credit?"},{lens:"bonds",question:"Are long-term funding costs remaining restrictive?"}]
 },
 "nvidia-ceo-transition-sec-2026-11-12":{
  players:"Nvidia supplies AI chips and software to computing customers, including large cloud operators. The dated filing concerns management succession, not a new customer-order announcement.",
  marketRelevance:"Leadership continuity may matter to customer confidence, product roadmaps and capital allocation; the investment question is whether actual orders, margins or cash generation change.",
  research:[{lens:"ai",question:"Are AI orders and cash returns resilient despite leadership uncertainty?"}]
 },
 "fermi-hyperscaler-600mw-sec-2026-11-12":{
  players:"Fermi develops power-ready infrastructure for large computing customers. The issuer describes an unnamed hyperscaler as the counterparty; the Financial Times identification of Amazon is attributed reporting, not company confirmation.",
  marketRelevance:"A development commitment can help fund a site, but the customer still needs a definitive lease and usable power capacity. The distinction matters to suppliers, tenants and lenders.",
  research:[{lens:"ai",question:"Are AI infrastructure plans becoming binding, revenue-producing commitments?"},{lens:"energy",question:"Is access to power becoming a binding constraint on computing capacity?"},{lens:"bonds",question:"Can developers finance construction before operating cash arrives?"}]
 },
 "bahrain-drones-hormuz-conflicting-claims-2026-11-13":{
  players:"The reporting concerns competing US and Iranian claims, Bahrain and a disputed tanker incident. Shippers, insurers and fuel buyers are the commercially exposed groups.",
  marketRelevance:"The relevant question is whether vessels, insurance and actual fuel deliveries are disrupted, rather than whether an escalation headline alone moved oil.",
  research:[{lens:"energy",question:"Is the bottleneck physical supply or an increase in risk premiums?"},{lens:"fed",question:"Could sustained fuel disruption feed inflation?"}]
 },
 "microsoft-365-service-incident-2026-11-12":{
  players:"Microsoft provides Microsoft 365 and Exchange Online to organisations relying on email and collaboration. These customers are affected by service reliability; the advisory does not establish an Azure-wide demand change.",
  marketRelevance:"Downtime can disrupt work and may increase remediation or service-credit costs. The investment question is whether repeated incidents materially affect retention, cash flow or cloud growth.",
  research:[{lens:"ai",question:"Do cloud infrastructure costs or reliability problems undermine returns?"}]
 },
 "binance-security-incident-2026-10-30":{
  players:"Binance operates a cryptocurrency exchange used by customers to hold and trade digital assets. Its initial statement describes estimated exposure and proposed user-loss coverage, not a final loss.",
  marketRelevance:"Exchange liquidity and confidence may affect trading and withdrawals. Separately compare wider risk appetite before treating a crypto decline as evidence of a broader equity regime change.",
  research:[] 
 },
 "tpg-ark-talks-2026-10-28":{
  players:"TPG is the reported prospective buyer, Elliott Management the reported seller and Ark Data Centres the target. Data-centre customers depend on capacity; the report does not name specific tenants.",
  marketRelevance:"The reported valuation is a potential infrastructure investment, not a signed deal or cash received. Funding terms, occupancy and operating earnings would determine its economics.",
  research:[{lens:"ai",question:"Can infrastructure capacity earn enough to justify acquisition and investment costs?"},{lens:"bonds",question:"How would the financing structure affect the economics?"}]
 }
};
export function newsroomContext(id:string):NewsroomContext|null{return Object.hasOwn(CONTEXT,id)?CONTEXT[id]:null;}
export const TOPIC_RESEARCH:Record<string,readonly EditorialRegimeId[]>={
 "oil-gulf-energy":["energy","fed"],"rates-bonds-credit":["bonds","fed"],
 "ai-technology":["ai"],"equities-earnings":["breadth"],"fx-global":[]
};
