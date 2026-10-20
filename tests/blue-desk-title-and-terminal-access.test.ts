import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Blue Desk page title excludes legacy Alchemy naming without changing other app branding", () => {
  const home = readFileSync(new URL("../app/blue-desk/page.tsx", import.meta.url), "utf8");
  const terminal = readFileSync(new URL("../app/owner/markets/page.tsx", import.meta.url), "utf8");
  assert.match(home, /title: "Blue Desk \| Market Intelligence"/);
  assert.doesNotMatch(home, /Blue Desk \| Alchemy Market Intelligence/);
  assert.match(terminal, /title: "Markets Terminal \| Blue Desk"/);
  assert.doesNotMatch(terminal, /Alchemy/);
});

test("anonymous full Markets terminal contains only market read components, not owner action chrome", () => {
  const terminal = readFileSync(new URL("../app/owner/markets/page.tsx", import.meta.url), "utf8");
  const core = readFileSync(new URL("../components/live-desk/MarketsMonitor.tsx", import.meta.url), "utf8");
  assert.match(terminal, /data-blue-desk-terminal="read-only"/);
  assert.match(terminal, /<MarketsMonitor monitor=\{monitor\} flows=\{flows\} \/>/);
  assert.doesNotMatch(terminal, /LiveDeskShell|VideoResearchStatus|PresenterPrepNavigationLink/);
  assert.match(core, /useState/);
  assert.doesNotMatch(core, /fetch\(|axios|createSupabaseAdminClient|\.from\(|\.insert\(|\.update\(|\.upsert\(/);
});
