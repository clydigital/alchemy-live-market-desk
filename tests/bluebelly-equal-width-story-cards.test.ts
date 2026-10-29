import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../components/blue-desk/DecisionBrief.module.css",import.meta.url),"utf8");
const component=readFileSync(new URL("../components/blue-desk/DecisionBrief.tsx",import.meta.url),"utf8");

test("public decision-first cards are equal width on desktop, not 1.5:1:1",()=>{
 assert.match(css,/\.topics\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(css,/grid-template-columns:1\.5fr repeat\(2,1fr\)/);
 assert.match(component,/className=\{s\.topics\}/);
 assert.match(css,/\.topic,\.lead\{[^}]*min-width:0/);
});

test("the fixed-width card grid wraps at tablet and phone breakpoints",()=>{
 assert.match(css,/@media\(max-width:1200px\)\{\.topics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
 assert.match(css,/@media\(max-width:700px\)\{\.topics,\.lanes\{grid-template-columns:1fr\}/);
 assert.ok(css.indexOf("@media(max-width:1200px)")<css.indexOf("@media(max-width:700px)"));
 assert.match(css,/\.topics :is\(h2,p,small,a\)\{overflow-wrap:anywhere\}/);
});
