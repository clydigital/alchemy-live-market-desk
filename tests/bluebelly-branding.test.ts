import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("Bluebelly owns the visible page, login and legacy workspace branding", () => {
  assert.match(source("app/layout.tsx"), /title: "Bluebelly \| Market Intelligence Workspace"/);
  assert.match(source("app/login/page.tsx"), /<p className=\{styles\.kicker\}>Bluebelly<\/p>/);
  const shell = source("components/live-desk/LiveDeskShell.tsx");
  assert.match(shell, /Bluebelly Research/);
  assert.doesNotMatch(shell, /Alchemy Research Core|Alchemy Markets/);
});

test("visible research widgets do not use Alchemy as their product identity", () => {
  for (const path of [
    "components/MarketWorkspace.tsx",
    "components/live-desk/ArticleMemoryWorkspace.tsx",
    "components/live-desk/StoryHeaderImage.tsx",
    "components/live-desk/PositioningWorkspace.tsx",
    "app/articles/page.tsx",
    "app/stories/[slug]/page.tsx",
    "app/data/positioning/page.tsx",
    "components/EconomicCalendar.tsx",
  ]) {
    assert.doesNotMatch(
      source(path),
      /Alchemy Markets|Alchemy Research Core|Alchemy View|ALCHEMY VIEW|ALCHEMY ARTICLE MEMORY|PRIOR ALCHEMY COVERAGE|Alchemy-first|Alchemy Challenger|ALCHEMY EXPECTATION/i,
      path,
    );
  }
});

test("fallback artwork is Bluebelly-labelled, while original source attribution survives", () => {
  assert.match(source("lib/story-images.ts"), /publisher: "Bluebelly"/);
  assert.doesNotMatch(source("lib/story-fallback-images.ts"), /Alchemy Markets fallback artwork/);
  assert.match(source("lib/alchemy.ts"), /Alchemy Markets/);
  assert.match(source("components/live-desk/PositioningWorkspace.tsx"), /type Mode = "alchemy" \| "legacy"/);
});

test("new editorial copy identifies Bluebelly without changing evidence authority", () => {
  assert.match(source("lib/market-editorial-runtime.ts"), /Bluebelly client-facing editorial formatter/);
  assert.match(source("lib/market-editorial-runtime.ts"), /not a second reasoning engine/);
  assert.match(source("lib/intelligence/runtime.ts"), /the reasoning layer behind Bluebelly/);
  assert.match(source("lib/high-impact-calendar-intake.ts"), /Desk expectation/);
});
