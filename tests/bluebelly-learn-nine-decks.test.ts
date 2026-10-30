import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blueDeskHostAccess, blueDeskPresentationTarget } from "../lib/blue-desk-host.ts";

const PUBLIC_HOST = "bluebelly-desk.vercel.app";
const deckSlides: Record<string, number> = {
  D02: 18, D06: 18, D08: 24, D13: 15, D15: 15,
  D17: 15, D23: 16, D24: 15, D26: 16,
};

test("nine versioned original slide editions contain all 152 pages", () => {
  let count = 0;
  for (const [id, expected] of Object.entries(deckSlides)) {
    const file = JSON.parse(readFileSync("lib/bluebelly-learn/slides/" + id + ".json", "utf8")) as {
      id: string; date: string; slides: Array<{ number: number; title: string; section: string; lines: string[] }>;
    };
    assert.equal(file.id, id);
    assert.equal(file.date, "2026-10-30");
    assert.equal(file.slides.length, expected);
    for (const [index, slide] of file.slides.entries()) {
      assert.equal(slide.number, index + 1);
      assert.ok(slide.title.length > 5);
      assert.ok(slide.section.length > 1);
      assert.ok(slide.lines.length > 0);
      assert.ok(!JSON.stringify(slide).includes("Speaker notes:"));
      assert.ok(!JSON.stringify(slide).includes("service_role"));
    }
    count += expected;
  }
  assert.equal(count, 152);
});

test("public Bluebelly exposes exactly nine known deck routes", () => {
  for (const id of Object.keys(deckSlides)) {
    const slug = id.toLowerCase();
    assert.equal(blueDeskHostAccess("/learn/decks/" + slug, PUBLIC_HOST), "public");
    assert.equal(blueDeskHostAccess("/blue-desk/learn/decks/" + slug, PUBLIC_HOST), "public");
    assert.equal(blueDeskPresentationTarget("/learn/decks/" + slug, PUBLIC_HOST),
      "/blue-desk/learn/decks/" + slug);
  }
  for (const path of [
    "/learn/decks/not-a-deck", "/learn/decks/d29", "/learn/decks/d02/private",
    "/blue-desk/learn/decks/d02/secrets", "/api/owner/research",
    "/blue-desk/learn/decks/%2e%2e",
  ]) {
    assert.equal(blueDeskHostAccess(path, PUBLIC_HOST), "blocked");
    assert.equal(blueDeskPresentationTarget(path, PUBLIC_HOST), null);
  }
});

test("new Learn reader depends on canonical glossary and no private evidence writers", () => {
  const lesson = readFileSync("app/blue-desk/learn/decks/[id]/page.tsx", "utf8");
  const home = readFileSync("app/blue-desk/learn/page.tsx", "utf8");
  const manifest = readFileSync("lib/bluebelly-learn-decks.ts", "utf8");
  assert.ok(lesson.includes('getConcept(name)'));
  assert.ok(home.includes("listConcepts()"));
  assert.ok(lesson.includes("noopener noreferrer"));
  for (const s of ["supabaseAdmin", "SUPABASE_SERVICE_ROLE_KEY", "notion_access_token", "owner/daily-research"]) {
    assert.ok(!lesson.includes(s));
    assert.ok(!manifest.includes(s));
  }
  assert.ok(lesson.includes("LearnOriginalPptxViewer"));
  assert.ok(!lesson.includes("LearnSlideReader"));
  assert.ok(lesson.includes("notFound()"));
});
