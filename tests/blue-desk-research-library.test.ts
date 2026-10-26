import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("research explorer is owner-only and cannot be reached through public Bluebelly hosts", () => {
  for (const host of ["bluebelly-desk.vercel.app", "alchemy-live-market-desk.vercel.app"]) {
    assert.notEqual(blueDeskHostAccess("/owner/research", host), "public");
    assert.equal(blueDeskPresentationTarget("/owner/research", host), null);
  }
  assert.equal(blueDeskHostAccess("/owner/research", "bluebelly-desk.vercel.app"), "blocked");
  assert.equal(blueDeskHostAccess("/owner/research", "private-preview.vercel.app"), "private");
  const nav = read("components/blue-desk/BlueDeskHeader.tsx");
  assert.match(nav, /\["Research", "\/owner\/research"\]/);
  const publicNav = nav.split("const PUBLIC_NAV = [")[1]?.split("] as const;")[0] ?? "";
  assert.doesNotMatch(publicNav, /\/owner\/research/);
});

test("research library is a read-only view over established Notion source intake", () => {
  const page = read("app/owner/research/page.tsx");
  const explorer = read("components/blue-desk/ResearchLibraryExplorer.tsx");
  assert.match(page, /fetchTodayNotionResearch/);
  assert.match(page, /data-owner-research-library="private-read-only"/);
  assert.doesNotMatch(page + explorer, /service_role|insert\(|update\(|delete\(|upsert\(|createSupabaseClient/);
  assert.match(explorer, /The search covers the visible index and recent retrieved page previews/);
  assert.match(explorer, /Research is not a Dossier decision/);
  assert.match(explorer, /Research Gap Registry/);
  assert.match(explorer, /MacroPulse Feed \/ Log/);
});
