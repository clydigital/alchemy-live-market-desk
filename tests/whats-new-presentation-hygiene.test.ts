import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const page = fs.readFileSync(path.join(process.cwd(), "app/whats-new/page.tsx"), "utf8");
const workspace = fs.readFileSync(path.join(process.cwd(), "components/live-desk/WhatsNewWorkspace.tsx"), "utf8");

test("What’s New sanitises machine event text and assigns age metadata", () => {
  assert.match(page, /readerFacingText\(event\.headline\)/);
  assert.match(page, /presentationAge\(delta\.timestamp, now\)/);
});

test("historical records remain visible but clearly labelled", () => {
  assert.match(workspace, /ageState === "historical"/);
  assert.match(workspace, /Historical context/);
});
