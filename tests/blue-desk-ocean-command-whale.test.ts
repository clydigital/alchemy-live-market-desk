import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/blue-desk/blue-desk.module.css", import.meta.url), "utf8");

test("exact original V6 Ocean Command whale photo remains in brand surfaces", () => {
  const match = css.match(/--ocean-command-whale:\s*url\("data:image\/jpeg;base64,([A-Za-z0-9+/=]+)"\)/);
  assert.ok(match, "source photo must be embedded verbatim, not substituted");
  const jpeg = Buffer.from(match[1], "base64");
  assert.equal(jpeg.length, 126577);
  assert.equal(createHash("sha256").update(jpeg).digest("hex"),
    "f3a0d520457d9c5aac03d719146fa73e8bdde57d85ea57edba6bb1783e698fc9");
  for (const selector of [".hero", ".storyCard", ".deepHero"]) {
    const index = css.lastIndexOf(selector + " {");
    assert.ok(index !== -1 && css.slice(index, index + 380).includes("var(--ocean-command-whale)"),
      selector + " must display the original whale image");
  }
});

test("photo is behind readable gradients, not exposed as an image-only headline", () => {
  assert.match(css, /linear-gradient\(90deg, #011727/);
  assert.match(css, /@media \(max-width: 840px\)/);
});
