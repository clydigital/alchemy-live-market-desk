import type {PublicMarketObservation} from "./blue-desk-public-markets";
export type DecisionMarketReading={
 symbol:string;last:number|null;d1:number|null;d3:number|null;d5:number|null;
 asOf:string|null;sourceName:string;sourceUrl:string|null;
};
export function decisionMarketReading(symbol:string,rows:readonly PublicMarketObservation[]):DecisionMarketReading|null{
 const row=rows.find(x=>x.symbol===symbol&&x.frequency==="daily"&&x.changeUnit==="%"&&x.asOf);
 return row?{symbol,last:row.last,d1:row.change,d3:row.change3d,d5:row.change5d,
  asOf:row.asOf,sourceName:row.sourceName,sourceUrl:row.sourceUrl}:null;
}
