export type ExposureSession={date:string;price:number;vix:number|null};
export type ExposureOptions={threshold?:number;cooldown?:number;maxWait?:number;horizon?:number;cost?:number};
export type ExposureDetail={episode:string;method:string;rec:string;sahmState:string;sahmValue:number|null;ret:number;mae:number;dd:number;exposure:number;entered:boolean;end:string};
export type ExposureSummary={group:string;method:string;n:number;entered:number;mean:number|null;hit:number|null;worstMAE:number|null;worstDD:number|null;exposure:number|null};
export function extendedTest(rows:ExposureSession[],recession?:Record<string,number>,sahm?:Record<string,number>,options?:ExposureOptions):{config:Required<ExposureOptions>;coverage:{sessions:number;first:string;last:string;missingVix:number};episodes:string[];summaries:ExposureSummary[];details:ExposureDetail[]};
