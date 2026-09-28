import assert from "node:assert/strict";
import test from "node:test";

import { getConcept, listConcepts } from "../lib/concepts.ts";

test("Concept registry exposes unique governed definitions", () => {
  const concepts = listConcepts();
  assert.equal(concepts.length, 21);
  assert.equal(new Set(concepts.map((concept) => concept.key)).size, concepts.length);
  assert.ok(concepts.every((concept) => concept.version === 1));
  assert.ok(concepts.every((concept) => concept.status === "active"));
  assert.ok(concepts.every((concept) => concept.regimes.length >= 1));
});

test("Concept aliases resolve to the same canonical identity", () => {
  assert.equal(getConcept("HBM")?.key, "hbm");
  assert.equal(getConcept("high bandwidth memory")?.key, "hbm");
  assert.equal(getConcept("real yields")?.key, "real-yield");
  assert.equal(getConcept("TTF")?.key, "lng-benchmarks");
  assert.equal(getConcept("opportunity cost")?.key, "gold-opportunity-cost");
  assert.equal(getConcept("not-a-real-concept"), null);
});
