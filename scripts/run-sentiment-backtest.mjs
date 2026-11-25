import {readFileSync} from "node:fs";
import {backtest} from "../lib/research/sentiment-backtest.mjs";
const file=process.argv[2];
if(!file)throw Error("Usage: node scripts/run-sentiment-backtest.mjs input.json");
const input=JSON.parse(readFileSync(file,"utf8"));
if(!Array.isArray(input.sessions)||!input.source||!input.instrument||!input.retrievedAt)throw Error("Require sessions plus source, instrument and retrieval metadata");
const result=backtest(input.sessions,input.options??{});
console.log(JSON.stringify({instrument:input.instrument,source:input.source,retrievedAt:input.retrievedAt,priceBasis:input.priceBasis??"UNSPECIFIED",...result},null,2));
