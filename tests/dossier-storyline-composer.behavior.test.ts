import assert from "node:assert/strict";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

let composerPromise: Promise<any> | null = null;

async function composerModule() {
  if (!composerPromise) {
    const source = readFileSync(new URL("../lib/intelligence/dossier-storyline-composer.ts", import.meta.url), "utf8")
      .replace(/import "server-only";\r?\n\r?\n/, "")
      .replace(
        'import { runStructuredStage, type OpenAIStageResult } from "./openai.ts";',
        `const runStructuredStage = async () => { throw new Error("OpenAI is not available in the pure composer test harness."); };
         type OpenAIStageResult<T> = {
           data: T;
           requestId: string | null;
           responseId: string | null;
           model: string;
           inputTokens: number | null;
           outputTokens: number | null;
           totalTokens: number | null;
         };`,
      );
    const path = join(tmpdir(), `alchemy-dossier-composer-${process.pid}-${Date.now()}.ts`);
    writeFileSync(path, source, "utf8");
    composerPromise = import(`${pathToFileURL(path).href}?v=${Date.now()}`).finally(() => {
      try {
        unlinkSync(path);
      } catch {
        // The imported module is already loaded; cleanup is best-effort only.
      }
    });
  }
  return composerPromise;
}

function story({
  id,
  position,
  confidence,
  status = "confirmed",
  assets = [],
  title = id,
}: {
  id: string;
  position: number;
  confidence: number;
  status?: string;
  assets?: string[];
  title?: string;
}) {
  return {
    position,
    storyId: id,
    snapshotId: `snapshot-${id}`,
    thesisVersionId: `version-${id}`,
    state: {
      id,
      title,
      marketQuestion: `What drives ${title}?`,
      thesis: `${title} thesis`,
      bestExplanation: `${title} explanation`,
      strongestSupport: `${title} support`,
      strongestContradiction: `${title} countercase`,
      confirmationCondition: `${title} confirms`,
      invalidationCondition: `${title} invalidates`,
      assets,
      confidence,
      status,
    },
  };
}

function baseDossier(stories: Array<{ id: string; confidence: number }> = []) {
  return {
    contractVersion: "dossier-briefing/v1",
    opening: {
      headline: "Base Dossier",
      summary: "Base summary",
      marketState: "Base state",
      topicChips: [],
    },
    quickSummary: [],
    primaryStoryline: null,
    lessons: stories.map((story, index) => ({
      number: index + 1,
      storyId: story.id,
      title: story.id,
      body: [`${story.id} current`],
      evidenceRefs: [],
      confidence: story.confidence,
    })),
    watchNow: [],
    ahead: { economicCalendar: [], earnings: [], geopoliticalClock: [] },
    sourceDiscipline: { interpretationNotes: [] },
    readAloud: { available: true },
    diagnostics: { warnings: [], eventHorizonCoverage: [] },
  };
}

test("candidate selection preserves base attention admission and never reintroduces excluded manifest memory", async () => {
  const { buildDossierComposerCandidates } = await composerModule();
  const manifest = [
    story({ id: "rates", position: 1, confidence: 96, assets: ["US02Y"], title: "Fed repricing lifts front-end yields" }),
    story({ id: "oil", position: 2, confidence: 94, assets: ["USOIL"], title: "Fuel inflation remains sticky" }),
    story({ id: "ai", position: 3, confidence: 93, assets: ["NVDA"] }),
    story({ id: "yen", position: 4, confidence: 92, assets: ["USDJPY"] }),
    story({ id: "breadth", position: 5, confidence: 91, assets: ["SPX"] }),
    story({ id: "credit", position: 6, confidence: 90, assets: ["HYG"] }),
    story({ id: "consumer", position: 7, confidence: 89, assets: ["XLY"] }),
    story({ id: "earnings", position: 8, confidence: 88, assets: ["QQQ"] }),
    story({ id: "new-calendar", position: 9, confidence: 1, status: "detected", assets: ["NZDUSD"] }),
    story({ id: "stale", position: 10, confidence: 99, status: "invalidated", assets: ["DXY"] }),
  ];
  const payload = {
    dossier: baseDossier([
      { id: "rates", confidence: 96 },
      { id: "new-calendar", confidence: 1 },
      { id: "oil", confidence: 94 },
    ]),
    canonicalStoryManifest: manifest,
    stories: [{ id: "new-calendar" }],
    marketTape: {
      regimeSummary: "Front-end yields and the dollar are firm on Fed repricing.",
      assets: [{ symbol: "US02Y", state: "higher", whyRelevant: "Fed repricing" }],
    },
  };

  const selected = buildDossierComposerCandidates(payload);
  const ids = selected.map((item: { storyId: string }) => item.storyId);

  assert.equal(selected.length, 3);
  assert.equal(ids[0], "rates");
  assert.ok(ids.includes("new-calendar"));
  assert.ok(ids.includes("oil"));
  assert.ok(!ids.includes("ai"));
  assert.ok(!ids.includes("stale"));
});

test("model output is sanitised to canonical node types, endpoint lineage, Story IDs and evidence", async () => {
  const { composePersistedDossierStorylines } = await composerModule();
  const payload = {
    dossier: baseDossier([{ id: "oil", confidence: 94 }, { id: "rates", confidence: 96 }]),
    canonicalStoryManifest: [
      story({ id: "oil", position: 1, confidence: 94, assets: ["USOIL"], title: "Fuel inflation" }),
      story({ id: "rates", position: 2, confidence: 96, assets: ["US02Y"], title: "Front-end yields" }),
    ],
    stories: [{ id: "rates" }],
    marketTape: {
      regimeSummary: "Fuel inflation and front-end yields remain the key transmission path.",
      assets: [
        { symbol: "USOIL", state: "firm", whyRelevant: "fuel inflation" },
        { symbol: "US02Y", state: "higher", whyRelevant: "policy repricing" },
      ],
    },
  };

  const fakeRunner = async <T>() => ({
    data: {
      opening: { headline: "Fuel inflation is feeding rates", summary: "The causal chain remains conditional." },
      storylines: [{
        id: "energy-rates",
        title: "Energy to rates",
        centralQuestion: "Can fuel inflation keep front-end yields firm?",
        summary: "Fuel inflation can keep policy expectations restrictive.",
        storyIds: ["oil", "rates", "invented"],
        nodes: [
          { id: "fuel", label: "Fuel inflation", type: "commodity", storyIds: ["oil"] },
          { id: "rates", label: "Front-end yields", type: "rates", storyIds: ["rates"] },
          { id: "bad-type", label: "Bad type", type: "banana", storyIds: ["rates"] },
        ],
        links: [
          {
            from: "fuel",
            to: "rates",
            relationship: "reprices policy expectations",
            evidenceStatus: "strongly_supported",
            evidenceRefs: ["invented-evidence"],
            supportingStoryIds: ["oil", "rates"],
          },
          {
            from: "fuel",
            to: "rates",
            relationship: "bad endpoint lineage",
            evidenceStatus: "inferred",
            evidenceRefs: [],
            supportingStoryIds: ["oil"],
          },
        ],
        strongestBreakCondition: "Fuel inflation normalises.",
      }],
      lessonOrder: ["rates", "oil", "invented"],
    } as T,
    requestId: "request-test",
    responseId: "response-test",
    model: "test-model",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
  });

  const result = await composePersistedDossierStorylines({ editionPayload: payload, modelRunner: fakeRunner });
  assert.ok(result.composition);
  const storyline = result.composition.storylines[0];

  assert.deepEqual(storyline.storyIds, ["oil", "rates"]);
  assert.deepEqual(storyline.nodes.map((node: { id: string; type: string }) => [node.id, node.type]), [["fuel", "commodity"], ["rates", "rates"]]);
  assert.equal(storyline.links.length, 1);
  assert.equal(storyline.links[0].evidenceStatus, "inferred");
  assert.deepEqual(storyline.links[0].evidenceRefs, []);
  assert.deepEqual(storyline.links[0].supportingStoryIds, ["oil", "rates"]);
  assert.ok(result.warnings.some((warning: string) => warning.includes("downgraded to inferred")));
  assert.deepEqual(result.composition.lessonOrder.slice(0, 2), ["rates", "oil"]);
  assert.equal(result.dossier?.lessons?.[0]?.confidence, 96);
  assert.equal(result.dossier?.lessons?.[1]?.confidence, 94);
});

test("missing market tape remains visible as composition debt", async () => {
  const { composePersistedDossierStorylines } = await composerModule();
  const payload = {
    dossier: baseDossier([{ id: "oil", confidence: 94 }]),
    canonicalStoryManifest: [story({ id: "oil", position: 1, confidence: 94, assets: ["USOIL"] })],
    stories: [],
  };

  const fakeRunner = async <T>() => ({
    data: {
      opening: { headline: "Oil context", summary: "Persistent Story context only." },
      storylines: [{
        id: "oil-context",
        title: "Oil context",
        centralQuestion: "What remains active?",
        summary: "Oil remains an active persistent Story.",
        storyIds: ["oil"],
        nodes: [{ id: "oil", label: "Oil", type: "commodity", storyIds: ["oil"] }],
        links: [],
        strongestBreakCondition: null,
      }],
      lessonOrder: ["oil"],
    } as T,
    requestId: null,
    responseId: null,
    model: "test-model",
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  });

  const result = await composePersistedDossierStorylines({ editionPayload: payload, modelRunner: fakeRunner });
  assert.ok(result.warnings.some((warning: string) => warning.includes("without persisted market tape")));
  assert.ok(result.dossier?.diagnostics?.warnings?.some((warning: string) => warning.includes("without persisted market tape")));
});
