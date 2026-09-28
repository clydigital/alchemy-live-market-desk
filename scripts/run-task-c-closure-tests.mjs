import { spawnSync } from "node:child_process";

const gates = [
  {
    label: "Task C lifecycle reconstruction matrix",
    file: "tests/task-c-closure.test.ts",
    pattern: "^Task C closure:",
  },
  {
    label: "Research Brain reliability + anti-hindsight",
    file: "tests/research-brain.test.ts",
    pattern: "^(6J\\. Continued investigation preserves its exact prior expected reaction|6K\\. Continued investigation preserves a prior null expectation|7D\\. Stock Radar clerical prune avoids spending the repair model pass|9\\. Model Orchestration: Single Provider Attempt per Pass \\(maxAttempts = 1\\)|9A\\. Primary model path cannot rewrite a continued investigation expectation|10A0\\. Structural repair path cannot rewrite a continued investigation expectation|10A\\. Compact recovery handles primary max_output_tokens without raising the primary budget|11\\. Deterministic Degradation Fallback & Traceability)$",
  },
  {
    label: "Investigation identity + lifecycle policy",
    file: "tests/research-brain-first-pass-contract.test.ts",
    pattern: "^Research Brain uses (prior investigation baselines for bounded divergence post-mortems|evidence-gated investigation lifecycle transitions)$",
  },
  {
    label: "Healthy analytical baseline through degraded predecessor",
    file: "tests/dossier-v2-manual-run.test.ts",
    pattern: "^Task C4 keeps the immutable predecessor while sourcing reasoning memory from the last healthy Dossier$",
  },
];

for (const gate of gates) {
  process.stdout.write(`\n=== ${gate.label} ===\n`);
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "--experimental-strip-types",
      `--test-name-pattern=${gate.pattern}`,
      gate.file,
    ],
    { stdio: "inherit" },
  );

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.stdout.write("\nTASK C CLOSURE GATE: PASS\n");
