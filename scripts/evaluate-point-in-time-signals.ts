import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {evaluatePointInTime,type Input} from "../lib/research/point-in-time-validation.ts";
const path=process.argv[2];
if(!path||process.argv.length!==3)throw Error("Usage: node --experimental-strip-types scripts/evaluate-point-in-time-signals.ts frozen-input.json");
const raw=readFileSync(path);
const report=evaluatePointInTime(JSON.parse(raw.toString("utf8")) as Input);
console.log(JSON.stringify({inputSha256:createHash("sha256").update(raw).digest("hex"),...report},null,2));
