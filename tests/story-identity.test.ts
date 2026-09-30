import assert from "node:assert/strict";
import test from "node:test";

import { resolvePersistentStoryIdentity } from "../lib/intelligence/story-identity.ts";

test("new Story takes the candidate identity", () => {
  assert.deepEqual(resolvePersistentStoryIdentity(null, {
    title: "Treasury supply is lifting term premium",
    marketQuestion: "Will supply keep long yields elevated?",
    dominantNarrative: "Long-end funding pressure is rising.",
  }), {
    title: "Treasury supply is lifting term premium",
    marketQuestion: "Will supply keep long yields elevated?",
    dominantNarrative: "Long-end funding pressure is rising.",
    preserved: false,
  });
});

test("existing Story keeps its durable identity while fresh event wording changes", () => {
  assert.deepEqual(resolvePersistentStoryIdentity({
    title: "Sovereign Funding & Global Cost of Capital",
    market_question: "Can governments and companies finance large capital needs cheaply?",
    dominant_narrative: "Debt supply and inflation keep required returns elevated.",
  }, {
    title: "30Y jumps after weak Treasury auction",
    marketQuestion: "Does today's auction force another repricing?",
    dominantNarrative: "The auction was weak.",
  }), {
    title: "Sovereign Funding & Global Cost of Capital",
    marketQuestion: "Can governments and companies finance large capital needs cheaply?",
    dominantNarrative: "Debt supply and inflation keep required returns elevated.",
    preserved: true,
  });
});

test("legacy missing identity fields may be filled without replacing populated fields", () => {
  assert.deepEqual(resolvePersistentStoryIdentity({
    title: "US–China AI Industrial Competition",
    market_question: null,
    dominant_narrative: null,
  }, {
    title: "CXMT pricing changes the memory race",
    marketQuestion: "Where does value migrate as AI compute gets cheaper?",
    dominantNarrative: "The AI price war is shifting economics toward memory and infrastructure.",
  }), {
    title: "US–China AI Industrial Competition",
    marketQuestion: "Where does value migrate as AI compute gets cheaper?",
    dominantNarrative: "The AI price war is shifting economics toward memory and infrastructure.",
    preserved: true,
  });
});
