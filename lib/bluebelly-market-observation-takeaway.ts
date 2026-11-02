import type {PublicMarketObservation} from "./blue-desk-public-markets.ts";
export type ObservationTakeaway={
 state:"DATED_OBSERVATION"|"NOT_MEASURED";
 observation:string;nextTest:string;
};
/** Pure arithmetic/source-status presentation, not a causal price explanation. */
export function marketObservationTakeaway(
 row:PublicMarketObservation,window:"1D"|"3D"|"5D",
):ObservationTakeaway{
 const value=window==="1D"?row.change:window==="3D"?row.change3d:row.change5d;
 if(row.last===null||row.asOf===null||value===null||
  !Number.isFinite(value)||row.frequency!=="daily"||
  row.dataStatus==="UNAVAILABLE_OR_STALE")
  return {state:"NOT_MEASURED",
   observation:"Comparable dated movement is unavailable or stale. No price direction or market cause can be assigned.",
   nextTest:"Obtain a source-dated series for this instrument and the chosen window."};
 const sign=value>0?"+":"";
 const unit=row.changeUnit==="bp"?" basis points":row.changeUnit==="pp"?" percentage points":"%";
 const nextTest=row.type==="Rates"?
  "Compare the matched yield observation with dated inflation and monetary-policy expectations; the price change alone establishes no cause.":
  row.type==="Energy"?
  "Check dated production, shipping, inventories and refined-product data before linking the move to a supply shock.":
  row.type==="Credit / Risk"?
  "Compare credit spreads and funding conditions over the same period before treating this as broader financial stress.":
  row.type==="AI / Semis"||row.type==="MAG7"?
  "Check the latest issuer guidance, earnings and sector-wide moves before assigning an AI demand or valuation explanation.":
  row.type==="Breadth"?
  "Check matching index participation and earlier sessions before calling this a durable trend.":
  "Check same-window benchmark and original economic or company releases before attributing the move to one headline.";
 return {
  state:"DATED_OBSERVATION",
  observation:`${row.label} (${row.symbol}) moved ${sign}${value.toFixed(2)}${unit} over ${window}, through source session ${row.asOf}. This is an observed move, not a verified reaction to any particular news.`,
  nextTest,
 };
}
