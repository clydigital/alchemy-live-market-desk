import type {RegimeMeterReading} from "./bluebelly-regime-market-meter.ts";
import type {RegimeDirectionId} from "./bluebelly-regime-direction-reads.ts";

/** Public card colour is an observed, source-dated proxy direction ONLY.
 * It cannot change the human-reviewed fundamental outlook or canonical Regime.
 * In particular, crude falling != diesel scarcity resolved; chips rising != profitable AI.
 */
export type LensSignalTone="improving"|"pressure"|"mixed"|"unknown";
export type LensCardSignal=Readonly<{
 tone:LensSignalTone;
 label:string;
 scope:string;
 readout:string;
 sourceDate:string|null;
 dateNote:string;
}>;
const SCOPES:Record<RegimeDirectionId,string>={
 ai:"Semiconductor ETF prices only",
 fed:"US 2Y yield only",
 bonds:"10Y/30Y Treasury yields only",
 breadth:"S&P 500 members above 50D only",
 energy:"Crude prices only · diesel may diverge"
};
const UP:Record<RegimeDirectionId,string>={
 ai:"Chip tape strengthening",
 fed:"Front-end rate pressure rising",
 bonds:"Long-end yield pressure rising",
 breadth:"Equity participation strengthening",
 energy:"Crude inflation pressure rising"
};
const DOWN:Record<RegimeDirectionId,string>={
 ai:"Chip tape weakening",
 fed:"Front-end rate pressure easing",
 bonds:"Long-end yield pressure easing",
 breadth:"Equity participation weakening",
 energy:"Crude price pressure easing"
};
const RISKS:readonly RegimeDirectionId[]=["fed","bonds","energy"];
/** The same directional semantics across Lens cards, Compass and the homepage.
 * A higher Treasury yield or crude price is more pressure, unlike higher breadth
 * or semiconductor prices. This is a proxy read, not a canonical verdict. */
export function proxySignalTone(id:RegimeDirectionId,direction:-1|0|1|null):LensSignalTone{
 if(direction===null)return "unknown";
 if(direction===0)return "mixed";
 const relief=RISKS.includes(id)?direction===-1:direction===1;
 return relief?"improving":"pressure";
}
function isMeasuredId(id:string):id is RegimeDirectionId{
 return id==="ai"||id==="fed"||id==="bonds"||id==="breadth"||id==="energy";
}
const unknown=(scope:string):LensCardSignal=>({
 tone:"unknown",label:"No dated market direction",
 scope,readout:"INSUFFICIENT / STALE",sourceDate:null,dateNote:"Review evidence inside"
});
export function lensCardSignal(lensId:string,readings:Record<RegimeDirectionId,RegimeMeterReading>):LensCardSignal{
 if(!isMeasuredId(lensId))return unknown("No comparable market proxy · historical editorial is separate");
 const r=readings[lensId];
 const scope=SCOPES[lensId];
 const measured=r.windows.find(w=>w.label===r.needlePeriod);
 if(r.state==="unavailable"||r.direction===null||!r.observedAt||
    !measured||measured.trend==="unknown"||measured.readout==="NOT SUPPLIED")
  return unknown(scope);
 const direction=r.direction;
 const tone=proxySignalTone(lensId,direction);
 const label=direction===0?"Mixed / flat proxy":
  direction===1?UP[lensId]:DOWN[lensId];
 return {tone,label,scope,
  readout:r.needlePeriod+" · "+measured.readout,
  sourceDate:r.observedAt,
  dateNote:r.state==="last_reported"?"LAST REPORTED":"SOURCE SESSION"};
}
