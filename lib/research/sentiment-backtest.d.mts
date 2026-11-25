export type Session={date:string;price:number;vix:number|null;oas?:number|null};
export type Options={threshold?:number;cooldown?:number;maxWait?:number;cost?:number;horizons?:number[]};
export type Summary={n:number;mean:number|null;median:number|null;hit:number|null;meanMAE:number|null;worstMAE:number|null;worstDrawdown:number|null;meanDeployed:number|null};
export type Result=Summary&{h:number;method:string;entered:number;pre2024:Summary;since2024:Summary};
export type Detail={h:number;method:string;episode:string;ret:number;mae:number;dd:number;deployed:number;entries:number;entryDates:{date:string;w:number}[];end:string};
export function backtest(rows:Session[],options?:Options):{config:Required<Options>;coverage:{sessions:number;first:string;last:string;missingVix:number;missingOas:number};episodes:{date:string;vix:number|null;price:number}[];result:Result[];details:Detail[]};
