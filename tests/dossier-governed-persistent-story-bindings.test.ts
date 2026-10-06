import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GOVERNED_DOSSIER_PERSISTENT_STORY_ALIASES,
  resolveGovernedPersistentStoryBindings,
} from "../lib/dossier-v2/persistent-story-bindings.ts";

const RATES_ID = "11111111-1111-4111-8111-111111111111";
const ENERGY_ID = "22222222-2222-4222-8222-222222222222";
const BREADTH_ID = "33333333-3333-4333-8333-333333333333";

test("D1 governed aliases resolve only exact configured persistent Story slugs", () => {
  const bindings = resolveGovernedPersistentStoryBindings([
    { id: RATES_ID, slug: "fed-long-end-stress", status: "publish" },
    { id: ENERGY_ID, slug: "iran-oil-inflation-rates", status: "develop" },
    { id: BREADTH_ID, slug: "market-breadth-health", status: "publish" },
    {
      id: "44444444-4444-4444-8444-444444444444",
      slug: "similar-but-not-governed",
      status: "publish",
    },
  ]);

  assert.deepEqual(bindings, [
    {
      analytical_story_id: "story:ai-leadership-counterweight",
      persistent_story_id: BREADTH_ID,
    },
    {
      analytical_story_id: "story:energy-product-stress",
      persistent_story_id: ENERGY_ID,
    },
    {
      analytical_story_id: "story-duration-broadening",
      persistent_story_id: RATES_ID,
    },
    {
      analytical_story_id: "story:rates-duration-stress",
      persistent_story_id: RATES_ID,
    },
    {
      analytical_story_id: "story:tech-narrow-relief",
      persistent_story_id: BREADTH_ID,
    },
    {
      analytical_story_id: "story:tech-narrow-riskon",
      persistent_story_id: BREADTH_ID,
    },
  ]);
});

test("D1 governed aliases fail closed for missing, ambiguous or discarded persistent Stories", () => {
  const bindings = resolveGovernedPersistentStoryBindings([
    { id: RATES_ID, slug: "fed-long-end-stress", status: "discarded" },
    { id: ENERGY_ID, slug: "iran-oil-inflation-rates", status: "develop" },
    {
      id: "55555555-5555-4555-8555-555555555555",
      slug: "iran-oil-inflation-rates",
      status: "develop",
    },
  ]);

  assert.deepEqual(bindings, []);
});

test("D1 governed binding registry contains no title, prose or fuzzy matching surface", () => {
  assert.equal(GOVERNED_DOSSIER_PERSISTENT_STORY_ALIASES.length, 6);

  const helper = readFileSync(
    new URL("../lib/dossier-v2/persistent-story-bindings.ts", import.meta.url),
    "utf8",
  );
  assert.match(helper, /\.in\("slug", slugs\)/);
  assert.doesNotMatch(helper, /title|similarity|embedding|levenshtein|fuzzy/i);
});

test("D1 production Dossier path injects governed bindings before packet assembly", () => {
  const manualRun = readFileSync(
    new URL("../lib/dossier-v2/manual-run.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    manualRun,
    /const governedPersistentStoryBindings = previousResolution\.persistenceAvailable[\s\S]*\? await loadGovernedPersistentStoryBindings\(client\)[\s\S]*: \[\]/,
  );
  assert.match(
    manualRun,
    /buildInputRequest\([\s\S]*\.\.\.governedPersistentStoryBindings[\s\S]*\.\.\.\(options\.persistentStoryBindings \?\? \[\]\)/,
  );
  assert.match(
    manualRun,
    /assembleDossierV2InputPacket\(request, snapshotResult\.snapshot\)/,
  );
});
