import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

test("P2 Divergence Recruitment Audit document exists and covers all required sections", () => {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const auditPath = path.join(rootDir, "docs", "P2_DIVERGENCE_RECRUITMENT_CURRENT_MAIN_AUDIT.md");

  assert.ok(fs.existsSync(auditPath), "docs/P2_DIVERGENCE_RECRUITMENT_CURRENT_MAIN_AUDIT.md must exist");

  const content = fs.readFileSync(auditPath, "utf8");

  // Check required section headings
  assert.match(content, /1\.\s+Genuinely Missing Capabilities/i);
  assert.match(content, /2\.\s+Capabilities Duplicated or Superseded/i);
  assert.match(content, /3\.\s+Recommended Micro-Partition Strategy/i);
  assert.match(content, /4\.\s+Exact Files Touched by Each/i);
  assert.match(content, /5\.\s+Risks/i);
  assert.match(content, /6\.\s+Old Pull Requests to Close/i);

  // Check required PR references
  assert.match(content, /#459/);
  assert.match(content, /#461/);
  assert.match(content, /#463/);

  // Check required merged PR references
  assert.match(content, /#504/);
  assert.match(content, /#511/);
  assert.match(content, /#512/);
});

test("Reserved runtime and research gap worker files have not been modified", () => {
  const statusOutput = execSync("git status --porcelain", { encoding: "utf8" });
  const modifiedFiles = statusOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim());

  const reservedFiles = [
    "lib/intelligence/runtime.ts",
    "lib/research-gap-worker.ts",
    "lib/research-gap-plan.ts",
    "lib/research-gap-lifecycle.ts",
    "lib/research-gap-prioritizer.ts",
  ];

  for (const reserved of reservedFiles) {
    assert.equal(
      modifiedFiles.includes(reserved),
      false,
      `Reserved file ${reserved} must not be modified during audit task.`,
    );
  }
});
