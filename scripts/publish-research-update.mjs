import { readFile } from "node:fs/promises";

const inputPath = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const dryRun = process.argv.includes("--dry-run");
const endpoint = process.env.LIVE_DESK_UPDATE_URL || "https://alchemy-live-market-desk.vercel.app/api/research-update";
const token = process.env.RESEARCH_UPDATE_TOKEN;

if (!inputPath) {
  console.error("Usage: npm run research:publish -- <run.json> [--dry-run]");
  process.exit(1);
}
if (!token) {
  console.error("RESEARCH_UPDATE_TOKEN is not configured.");
  process.exit(1);
}

const payload = JSON.parse(await readFile(inputPath, "utf8"));
if (dryRun) payload.dryRun = true;

const result = await fetch(endpoint, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});
const text = await result.text();
if (!result.ok) {
  console.error(`Research update failed (${result.status}): ${text}`);
  process.exit(1);
}
console.log(text);
