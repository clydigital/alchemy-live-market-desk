import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handleScheduledResearchGapCycle,
  handleScheduledResearchGapHandoff,
} from "../lib/research-gap-cron.ts";

function request() {
  return new Request("https://live.example/api/cron/research-gap/cycle", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

async function withCronSecret<T>(run: () => Promise<T>) {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

test("Vercel Research Gap cycle retries completed handoff and stops before new web research", async () => {
  await withCronSecret(async () => {
    let researched = false;
    const result = await handleScheduledResearchGapCycle(request(), {
      authorised: () => true,
      handoff: async () => Response.json({
        status: "handed_off",
        caseId: "case-1",
      }),
      research: async () => {
        researched = true;
        return Response.json({ status: "completed" });
      },
    });

    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.status, "completed");
    assert.equal(body.action, "handoff_only");
    assert.equal(researched, false);
  });
});

test("Vercel Research Gap cycle researches at most one case and leaves canonical handoff for the later cron", async () => {
  await withCronSecret(async () => {
    let researchCalls = 0;
    const result = await handleScheduledResearchGapCycle(request(), {
      authorised: () => true,
      handoff: async () => Response.json({ status: "empty" }),
      research: async () => {
        researchCalls += 1;
        return Response.json({
          status: "completed",
          caseId: "case-2",
          gapKey: "gap:2",
        });
      },
    });

    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.action, "researched_one");
    assert.equal(body.caseId, "case-2");
    assert.equal(body.canonicalHandoff, "pending_scheduled_retry");
    assert.equal(researchCalls, 1);
  });
});

test("Vercel Research Gap cycle may close superseded D7 work before finding no ordinary work", async () => {
  await withCronSecret(async () => {
    const result = await handleScheduledResearchGapCycle(request(), {
      authorised: () => true,
      handoff: async () => Response.json({ status: "closed_superseded" }),
      research: async () => Response.json({ status: "empty" }),
    });

    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.action, "closed_superseded_only");
  });
});

test("Vercel Research Gap handoff cron remains handoff-only", async () => {
  await withCronSecret(async () => {
    const result = await handleScheduledResearchGapHandoff(request(), {
      authorised: () => true,
      handoff: async () => Response.json({
        status: "handed_off",
        caseId: "case-3",
      }),
      research: async () => {
        throw new Error("handoff cron must never research");
      },
    });

    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.action, "handed_off");
  });
});

test("Research Gap Vercel cron routes are runtime-only and scheduled independently from GitHub", () => {
  const cycleRoute = readFileSync(
    new URL("../app/api/cron/research-gap/cycle/route.ts", import.meta.url),
    "utf8",
  );
  const handoffRoute = readFileSync(
    new URL("../app/api/cron/research-gap/handoff/route.ts", import.meta.url),
    "utf8",
  );
  const vercel = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as { crons: Array<{ path: string; schedule: string }> };
  const workflow = readFileSync(
    new URL("../.github/workflows/run-live-research.yml", import.meta.url),
    "utf8",
  );

  assert.match(cycleRoute, /dynamic = "force-dynamic"/);
  assert.match(cycleRoute, /maxDuration = 300/);
  assert.match(handoffRoute, /dynamic = "force-dynamic"/);

  const gapCrons = vercel.crons.filter((item) =>
    item.path.startsWith("/api/cron/research-gap/"),
  );
  assert.deepEqual(gapCrons, [
    { path: "/api/cron/research-gap/cycle", schedule: "15 3 * * *" },
    { path: "/api/cron/research-gap/handoff", schedule: "30 3 * * *" },
    { path: "/api/cron/research-gap/handoff", schedule: "45 3 * * *" },
    { path: "/api/cron/research-gap/cycle", schedule: "15 15 * * *" },
    { path: "/api/cron/research-gap/handoff", schedule: "30 15 * * *" },
    { path: "/api/cron/research-gap/handoff", schedule: "45 15 * * *" },
  ]);

  assert.doesNotMatch(workflow, /cron: "15 3 \* \* \*"/);
  assert.doesNotMatch(workflow, /cron: "15 15 \* \* \*"/);
  assert.match(workflow, /- research_gap_cycle/);
  assert.match(workflow, /env\.MODE == 'research_gap_cycle'/);
});
