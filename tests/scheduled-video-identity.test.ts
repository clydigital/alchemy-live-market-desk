import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  SCHEDULED_VIDEO_CRON_UTC,
  scheduledVideoRunIdentity,
  scheduledVideoSlotForDesk,
} from "../lib/scheduled-video-identity.ts";

test("desk checkpoint lookup uses the exact video run identity produced by each dedicated cycle", () => {
  const morning = scheduledVideoRunIdentity(
    scheduledVideoSlotForDesk("morning"),
    new Date("2026-08-17T01:00:00.000Z"),
  );
  const evening = scheduledVideoRunIdentity(
    scheduledVideoSlotForDesk("evening"),
    new Date("2026-08-17T13:00:00.000Z"),
  );

  assert.deepEqual(morning, {
    runKey: "video_midnight-2026-08-17",
    scheduledFor: "2026-08-17T09:00:00+08:00",
  });
  assert.deepEqual(evening, {
    runKey: "video_late_morning-2026-08-17",
    scheduledFor: "2026-08-17T21:00:00+08:00",
  });
  assert.deepEqual(SCHEDULED_VIDEO_CRON_UTC, {
    video_midnight: "0 1 * * *",
    video_late_morning: "0 13 * * *",
  });
});

test("dedicated cron routes and desk lookup share the canonical video identity helper", () => {
  const videoHandler = readFileSync(new URL("../lib/video-intake-handler.ts", import.meta.url), "utf8");
  const deskInput = readFileSync(new URL("../lib/scheduled-research-input.ts", import.meta.url), "utf8");
  const midnightRoute = readFileSync(new URL("../app/api/cron/video/midnight/route.ts", import.meta.url), "utf8");
  const lateMorningRoute = readFileSync(new URL("../app/api/cron/video/late-morning/route.ts", import.meta.url), "utf8");
  const vercelConfig = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");

  assert.match(videoHandler, /scheduledVideoRunIdentity\(slot, startedAt\)/);
  assert.match(deskInput, /scheduledVideoSlotForDesk\(slot\)/);
  assert.match(deskInput, /scheduledVideoRunIdentity\(videoSlot, now\)/);
  assert.match(midnightRoute, /handleVideoIntakeRequest\(request, "video_midnight"\)/);
  assert.match(lateMorningRoute, /handleVideoIntakeRequest\(request, "video_late_morning"\)/);
  assert.match(vercelConfig, /"\/api\/cron\/video\/midnight"[\s\S]*"0 1 \* \* \*"/);
  assert.match(vercelConfig, /"\/api\/cron\/video\/late-morning"[\s\S]*"0 13 \* \* \*"/);
});

test("targeted transcript retries and advertised policy stay on Supadata native captions", () => {
  const videoHandler = readFileSync(new URL("../lib/video-intake-handler.ts", import.meta.url), "utf8");
  const supadataStore = readFileSync(new URL("../lib/supadata-transcript-store.ts", import.meta.url), "utf8");

  assert.match(videoHandler, /retrieveSupadataVideo/);
  assert.match(videoHandler, /new SupadataTranscriptStore\(\)/);
  assert.match(videoHandler, /provider:\s*"supadata"/);
  assert.match(videoHandler, /transcriptProvider:\s*"Supadata native captions"/);
  assert.match(videoHandler, /transcriptMode:\s*"native"/);
  assert.match(videoHandler, /transcriptFormat:\s*"timestamped"/);
  assert.match(videoHandler, /generatedTranscriptFallback:\s*false/);
  assert.doesNotMatch(videoHandler, /retrieveTranscriptApiVideo/);
  assert.doesNotMatch(videoHandler, /TRANSCRIPT_API_KEY/);

  assert.match(supadataStore, /constructor\(client\?: SupabaseClient\)/);
  assert.match(supadataStore, /client \?\? createSupabaseAdminClient\(\)/);
});

test("database contract accepts Supadata while preserving legacy transcript providers", () => {
  const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
  const migrationName = readdirSync(migrationsDirectory).find((name) => name.endsWith("_allow_supadata_transcript_provider.sql"));
  assert.ok(migrationName, "Supadata provider constraint migration is required");
  const migration = readFileSync(new URL(migrationName, migrationsDirectory), "utf8");

  assert.match(migration, /drop constraint if exists research_intake_items_transcript_provider_check/i);
  assert.match(migration, /add constraint research_intake_items_transcript_provider_check/i);
  for (const provider of ["transcriptapi", "supadata", "youtubetotranscript.com", "official", "other"]) {
    assert.match(migration, new RegExp(`'${provider.replace(".", "\\.")}'::text`));
  }
});
