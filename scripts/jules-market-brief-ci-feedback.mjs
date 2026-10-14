/**
 * Bounded LIVE Market Brief CI -> Jules feedback loop.
 * Runs on trusted main via Actions workflow_run, schedule and manual dispatch.
 * Only reads PR/check state, sends a correction to the EXISTING Jules session,
 * and writes an idempotency audit comment. Never merges or pushes code.
 */
import { appendFileSync } from "node:fs";

const REPO = "clydigital/alchemy-live-market-desk";
const PR = 778;
const SESSION = "16344947378108698651";
const MAX_CORRECTIONS = 4;
const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const JULES_KEY = process.env.JULES_AMLYC || "";
const GH_BASE = "https://api.github.com";
const SESSION_URL = "https://jules.googleapis.com/v1alpha/sessions/" + SESSION;
const marker = (sha) => `<!-- jules-feedback:${PR}:${sha} -->`;

function summary(line) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
}

async function request(url, options = {}) {
  const signal = AbortSignal.timeout(12_000);
  const res = await fetch(url, { ...options, signal });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${new URL(url).pathname}: ${body.slice(0, 240)}`);
  return body ? JSON.parse(body) : null;
}

function github(path, init = {}) {
  return request(GH_BASE + path, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${GH_TOKEN}`,
      ...(init.headers || {}),
    },
  });
}

function terminalCheck(checks) {
  const matches = (checks || []).filter(c => c.name === "validate");
  const done = matches.filter(c => c.status === "completed");
  return done.sort((a,b) => Date.parse(b.completed_at || "") - Date.parse(a.completed_at || ""))[0] || null;
}

async function allComments() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const rows = await github(`/repos/${REPO}/issues/${PR}/comments?per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw new Error("Invalid GitHub comments response");
    out.push(...rows);
    if (rows.length < 100) return out;
  }
  throw new Error("Comment marker pagination exceeded five pages; refuse duplicate Jules feedback");
}

async function run() {
  summary("### LIVE Market Brief — bounded Jules CI feedback");
  if (!GH_TOKEN) throw new Error("Missing read/write GitHub token");
  const pr = await github(`/repos/${REPO}/pulls/${PR}`);
  if (pr.state !== "open" || pr.merged_at) return summary("PR #778 closed/merged; feedback not needed.");
  const sha = pr.head?.sha;
  if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("Unexpected PR head SHA");

  // GitHub Actions may finish in different orders. Never treat pending as failure.
  const check = await github(`/repos/${REPO}/commits/${sha}/check-runs?per_page=100`);
  const validate = terminalCheck(check.check_runs);
  if (!validate) return summary(`Head ${sha.slice(0, 12)} has no completed validate result; no feedback.`);
  summary(`PR #${PR} head ${sha.slice(0, 12)} validate: ${validate.conclusion}`);
  if (validate.conclusion === "success") return summary("CI validate passed; independent canonical review still required. No automatic merge.");
  if (validate.conclusion !== "failure") return summary("No actionable failing validate conclusion; no feedback.");

  const comments = await allComments();
  const bodies = comments.map(x => x.body || "");
  if (bodies.some(body => body.includes(marker(sha)))) return summary("This exact failed SHA was already sent; no duplicate Jules message.");
  const sent = bodies.flatMap(body => [...body.matchAll(/<!-- jules-feedback:778:([0-9a-f]{40}) -->/g)].map(x=>x[1]));
  if (new Set(sent).size >= MAX_CORRECTIONS) return summary("Automatic correction budget exhausted; manual review required. No new Jules task.");

  if (!JULES_KEY) {
    summary("JULES_AMLYC not configured; cannot auto-send; leaving PR blocked.");
    return;
  }
  const headers = { "X-Goog-Api-Key": JULES_KEY, "Content-Type": "application/json" };
  // A readable session proves account entitlement before any message is sent.
  const session = await request(SESSION_URL, { headers });
  if (/^(?:FAILED|CANCELLED|EXPIRED)$/.test(session?.state || "")) return summary(`Jules session ${session.state}; automatic resend disabled.`);

  const checksUrl = `https://github.com/${REPO}/actions/runs/${validate.check_suite?.id || ""}`;
  const prompt =
    `LIVE Market Brief PR #${PR} has a NEW failing CI head ${sha}. ` +
    `Fix the actual failing 'validate' job: ${validate.html_url || checksUrl}. ` +
    "Rebase on latest main. Preserve canonical admission tests, never weaken/remove them. " +
    "No inferred System 2 verdict from confidence, invented market reaction/mechanism/thresholds, " +
    "fake Dossier UUID or source URL, or broad source attribution across unrelated claims. " +
    "Omit unsupported paragraphs and use PARTIAL/INSUFFICIENT_DATA when necessary. " +
    "Keep reader keyboard scope and remove build artifacts. Push corrected PR head; DO NOT MERGE.";
  await request(SESSION_URL + ":sendMessage", {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt }),
  });
  await github(`/repos/${REPO}/issues/${PR}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: `Automated Jules correction sent for failed validate on \`${sha}\`. Exact CI check: ${validate.html_url || "unavailable"}. Budget ${new Set(sent).size + 1}/${MAX_CORRECTIONS}. No automatic merge.\n\n${marker(sha)}`,
    }),
  });
  summary(`Sent one correction to existing Jules session for head ${sha.slice(0, 12)}. Waiting for new PR head and CI.`);
}

run().catch(error => { console.error(String(error?.message || error)); process.exitCode = 1; });
