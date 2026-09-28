import assert from "node:assert/strict";
import test from "node:test";

import {
  detectSystem1TelemetryStateChanges,
  selectSystem2ActivationTargets,
} from "../lib/regime-system2-activation.ts";
import type { ProjectedRegime, ProjectedStory } from "../lib/regimes.ts";

function story(id: string, role: "core" | "supporting" | "bridge", score: number): ProjectedStory {
  return {
    id,
    slug: id,
    title: id,
    thesis: `${id} thesis`,
    question: null,
    confidence: 70,
    lifecycle: "developing",
    editorialVerdict: null,
    assets: [],
    versionId: `${id}-v1`,
    versionNumber: 1,
    routes: [{ regime: "global-cost-of-capital", subgroup: "long-end", role, score }],
    maturity: "durable",
    contributesToState: true,
    maturityReason: "test",
    hybridHref: `/hybrid-output?story=${id}`,
  };
}

function regime(): ProjectedRegime {
  const core = story("core-story", "core", 90);
  const support = story("support-story", "supporting", 70);
  return {
    slug: "global-cost-of-capital",
    title: "Sovereign Funding & Global Cost of Capital",
    shortTitle: "Cost of Capital",
    coreQuestion: "question",
    whyItMatters: "why",
    mechanism: "mechanism",
    affectedMarkets: [],
    state: "partial",
    stateKind: "unresolved",
    confidence: "PARTIAL",
    asOf: "2026-09-28T06:01:00Z",
    stories: [core, support],
    durableStories: [core, support],
    contextStories: [],
    latestNode: null,
    hybridHref: "/hybrid-output?regime=global-cost-of-capital",
    subgroups: [{
      key: "long-end",
      label: "Long End / Term Premium",
      accent: "orange",
      whyItMatters: "why",
      mechanism: "mechanism",
      state: "Restrictive / tighter",
      stateKind: "system1",
      stories: [core, support],
      durableStories: [core, support],
      contextStories: [],
      nodes: [],
      telemetry: [{
        key: "LONG_END",
        label: "Long-end pressure",
        state: "Restrictive",
        detail: "10Y remains elevated",
        asOf: "2026-09-28T06:01:00Z",
        source: "rate-regime/1",
      }],
      latestAt: "2026-09-28T06:01:00Z",
    }],
  };
}

test("same-contract System 1 state changes recruit System 2", () => {
  const current = regime();
  const prior = {
    regime: {
      subgroups: [{
        key: "long-end",
        telemetry: [{
          key: "LONG_END",
          label: "Long-end pressure",
          state: "Mixed",
          source: "rate-regime/1",
        }],
      }],
    },
  };

  const changes = detectSystem1TelemetryStateChanges(prior, current);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].fromState, "Mixed");
  assert.equal(changes[0].toState, "Restrictive");

  const targets = selectSystem2ActivationTargets(current, changes);
  assert.deepEqual(targets.map((item) => item.storyId), ["core-story", "support-story"]);
  assert.match(targets[0].reason, /system1_threshold_crossing/);
  assert.match(targets[0].reason, /Mixed -> Restrictive/);
});

test("new sensors and contract changes do not masquerade as market transitions", () => {
  const current = regime();
  const noSensor = { regime: { subgroups: [{ key: "long-end", telemetry: [] }] } };
  assert.deepEqual(detectSystem1TelemetryStateChanges(noSensor, current), []);

  const oldContract = {
    regime: {
      subgroups: [{
        key: "long-end",
        telemetry: [{
          key: "LONG_END",
          state: "Mixed",
          source: "rate-regime/0",
        }],
      }],
    },
  };
  assert.deepEqual(detectSystem1TelemetryStateChanges(oldContract, current), []);
});

test("unchanged telemetry does not wake System 2", () => {
  const current = regime();
  const prior = {
    regime: {
      subgroups: [{
        key: "long-end",
        telemetry: [{
          key: "LONG_END",
          state: "Restrictive",
          source: "rate-regime/1",
        }],
      }],
    },
  };
  assert.deepEqual(detectSystem1TelemetryStateChanges(prior, current), []);
});

test("activation remains bounded to the canonical Story-maintenance budget", () => {
  const current = regime();
  const extras = Array.from({ length: 6 }, (_, index) => story(`story-${index}`, "supporting", 60 - index));
  current.subgroups[0].durableStories = [...current.subgroups[0].durableStories, ...extras];
  current.subgroups[0].stories = current.subgroups[0].durableStories;
  current.durableStories = current.subgroups[0].durableStories;
  current.stories = current.durableStories;

  const changes = [{
    regimeSlug: current.slug,
    subgroupKey: "long-end",
    subgroupLabel: "Long End / Term Premium",
    telemetryKey: "LONG_END",
    telemetryLabel: "Long-end pressure",
    source: "rate-regime/1",
    fromState: "Mixed",
    toState: "Restrictive",
  }];

  const targets = selectSystem2ActivationTargets(current, changes);
  assert.equal(targets.length, 4);
  assert.equal(targets[0].storyId, "core-story");
});
