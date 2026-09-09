import assert from "node:assert/strict";
import test from "node:test";

import {
  buildResearchAttentionPacket,
  calculateAttentionReservations,
  RESEARCH_ATTENTION_SHADOW_V1,
  type ResearchAttentionInput,
} from "../lib/research-attention.ts";

function item(
  key: string,
  title: string,
  overrides: Partial<ResearchAttentionInput> = {},
): ResearchAttentionInput {
  return {
    itemKey: key,
    publisher: `Publisher ${key}`,
    title,
    url: `https://example-${key}.com/${key}`,
    publishedAt: "2026-09-10T00:00:00.000Z",
    summary: title,
    sourceQuality: 75,
    relevance: 75,
    novelty: 70,
    materiality: 70,
    recommendedAction: "collect_evidence",
    divergenceKind: "none",
    ...overrides,
  };
}

test("reservation-style attention capacity for eight slots is 2/2/1/3", () => {
  assert.deepEqual(calculateAttentionReservations(8), {
    contradiction: 2,
    currentDelta: 2,
    emerging: 1,
    open: 3,
    total: 8,
  });
});

test("discovery-only watch inputs stay visible but cannot consume a research slot", () => {
  const packet = buildResearchAttentionPacket([
    item("power", "Uranium supply watch marker", {
      publisher: "Power Stack",
      recommendedAction: "ignore",
      sourceQuality: 35,
      relevance: 35,
      novelty: 30,
      materiality: 30,
    }),
  ], { generatedAt: "2026-09-10T00:00:00.000Z" });

  assert.equal(packet.contractVersion, RESEARCH_ATTENTION_SHADOW_V1);
  assert.equal(packet.selected.length, 0);
  assert.equal(packet.watchOnly.length, 1);
  assert.equal(packet.watchOnly[0].canonicalEligibleItemCount, 0);
});

test("reservations protect contradiction, current-delta and emerging work before open fill", () => {
  const inputs = [
    item("contra-a", "Refining cracks diverge from crude prices", { divergenceKind: "contradiction", materiality: 76 }),
    item("contra-b", "Credit spreads diverge from equity optimism", { divergenceKind: "contradiction", materiality: 74 }),
    item("delta-a", "Treasury term premium reprices funding conditions", { materiality: 88, novelty: 72 }),
    item("delta-b", "Japan yields alter global duration demand", { materiality: 84, novelty: 74 }),
    item("emerge", "New insurance collateral channel appears", { materiality: 62, novelty: 91 }),
    item("open-a", "Copper inventories tighten at delivery hubs", { materiality: 72, novelty: 76 }),
    item("open-b", "Korean memory exports accelerate again", { materiality: 71, novelty: 73 }),
    item("open-c", "China household credit remains subdued", { materiality: 69, novelty: 68 }),
    item("open-d", "Shipping insurance costs rise on rerouting", { materiality: 67, novelty: 66 }),
  ];

  const packet = buildResearchAttentionPacket(inputs, {
    generatedAt: "2026-09-10T00:00:00.000Z",
    maxSlots: 8,
  });

  assert.equal(packet.selected.length, 8);
  assert.equal(packet.selected.filter((candidate) => candidate.reservationLane === "contradiction").length, 2);
  assert.equal(packet.selected.filter((candidate) => candidate.reservationLane === "current_delta").length, 2);
  assert.equal(packet.selected.filter((candidate) => candidate.reservationLane === "emerging").length, 1);
  assert.equal(packet.selected.filter((candidate) => candidate.reservationLane === "open").length, 3);
});

test("unused reservations spill into open capacity rather than wasting research slots", () => {
  const inputs = [
    item("open-0", "Copper warehouse availability tightens", { materiality: 66, novelty: 65 }),
    item("open-1", "Korean memory export receipts accelerate", { materiality: 66, novelty: 65 }),
    item("open-2", "China household credit appetite stays weak", { materiality: 66, novelty: 65 }),
    item("open-3", "Shipping insurance premia rise on rerouting", { materiality: 66, novelty: 65 }),
    item("open-4", "Uranium term contracting activity broadens", { materiality: 66, novelty: 65 }),
    item("open-5", "Grid transformer lead times extend", { materiality: 66, novelty: 65 }),
    item("open-6", "Fertilizer feedstock spread widens", { materiality: 66, novelty: 65 }),
    item("open-7", "Cloud software renewal cycles improve", { materiality: 66, novelty: 65 }),
  ];

  const packet = buildResearchAttentionPacket(inputs, {
    generatedAt: "2026-09-10T00:00:00.000Z",
    maxSlots: 8,
  });

  assert.equal(packet.selected.length, 8);
  assert.equal(packet.selected.every((candidate) => candidate.reservationLane === "open"), true);
});

test("same-host duplicates do not manufacture independent source breadth", () => {
  const packet = buildResearchAttentionPacket([
    item("dup-a", "Oil products remain tight after refinery outage", {
      publisher: "Wire copy A",
      url: "https://wire.example.com/a",
    }),
    item("dup-b", "Oil products remain tight after refinery outage update", {
      publisher: "Wire copy B",
      url: "https://wire.example.com/b",
    }),
  ], { generatedAt: "2026-09-10T00:00:00.000Z" });

  assert.equal(packet.selected.length, 1);
  assert.equal(packet.selected[0].canonicalEligibleItemCount, 2);
  assert.equal(packet.selected[0].independentAncestryCount, 1);
});
