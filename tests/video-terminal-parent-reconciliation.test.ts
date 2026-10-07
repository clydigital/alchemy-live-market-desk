import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileTerminalVideoParentRuns,
} from "../lib/youtube-transcript-persistence.ts";

function harness(slotStatus: "completed" | "failed" | "running") {
  const parent = {
    id: "video-parent-1",
    status: "running",
    updated_at: "2026-08-28T01:02:49.756Z",
    completed_at: null as string | null,
  };
  const slot = {
    status: slotStatus,
    completed_at: null as string | null,
    last_heartbeat_at: "2026-08-28T01:02:50.034Z",
  };

  const client = {
    from(table: string) {
      return {
        select() {
          if (table === "research_runs") {
            const query = {
              eq() { return query; },
              lt: async () => ({ data: [parent], error: null }),
            };
            return query;
          }
          const query = {
            eq() { return query; },
            maybeSingle: async () => ({ data: slot, error: null }),
          };
          return query;
        },
        update(payload: Record<string, unknown>) {
          const filters = new Map<string, unknown>();
          const query = {
            eq(column: string, value: unknown) {
              filters.set(column, value);
              return query;
            },
            select() { return query; },
            async maybeSingle() {
              const matches = filters.get("id") === parent.id
                && filters.get("status") === "running"
                && filters.get("updated_at") === parent.updated_at;
              if (!matches) return { data: null, error: null };
              Object.assign(parent, payload);
              return { data: { id: parent.id }, error: null };
            },
          };
          return query;
        },
      };
    },
  } as unknown as NonNullable<Parameters<typeof reconcileTerminalVideoParentRuns>[0]["client"]>;

  return { client, parent, slot };
}

test("completed video slot reconciles only its stale running parent", async () => {
  const { client, parent, slot } = harness("completed");
  const result = await reconcileTerminalVideoParentRuns({
    slot: "video_midnight",
    now: new Date("2026-10-08T00:00:00.000Z"),
    client,
  });

  assert.deepEqual(result, { reconciledCount: 1 });
  assert.equal(parent.status, "completed");
  assert.equal(parent.completed_at, slot.last_heartbeat_at);
});

test("non-terminal video slot cannot terminalise its parent", async () => {
  const { client, parent } = harness("running");
  const result = await reconcileTerminalVideoParentRuns({
    slot: "video_midnight",
    now: new Date("2026-10-08T00:00:00.000Z"),
    client,
  });

  assert.deepEqual(result, { reconciledCount: 0 });
  assert.equal(parent.status, "running");
  assert.equal(parent.completed_at, null);
});
