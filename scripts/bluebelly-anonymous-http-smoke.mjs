#!/usr/bin/env node
/**
 * CI-only anonymous HTTP acceptance for the built Next.js app.
 *
 * This exercises the real Next.js middleware and server-rendered routes with
 * synthetic Host headers on 127.0.0.1. It is NOT an authenticated owner,
 * deployment-protection, real-DNS, or responsive-browser acceptance test.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const port = 41983;
const base = `http://127.0.0.1:${port}`;
const BLUE = "bluebelly-desk.vercel.app";
const LIVE = "alchemy-live-market-desk.vercel.app";
const PREVIEW = "preview-bluebelly-qa.vercel.app";
const edition = "fcea17ef-f575-4283-a363-7d5fa9c918c7";

// In particular, this local CI proof must not contact a production Supabase
// account or generate an AI draft if secrets are ever present in CI.
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/(?:SUPABASE|GEMINI|OPENAI|ANTHROPIC|SERVICE_ROLE|VERCEL_OIDC_TOKEN|BYPASS_TOKEN|RESEARCH_SHARED_KEY|CRON_SECRET)/i.test(name)));
env.NODE_ENV = "production";
const server = spawn(process.execPath, [
  "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1",
  "--port", String(port),
], { env, cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });

let output = "";
const log = (chunk) => {
  output = (output + chunk.toString()).slice(-6000);
};
server.stdout.on("data", log);
server.stderr.on("data", log);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(host, path) {
  const response = await fetch(base + path, {
    method: "GET",
    headers: { Host: host, Accept: "text/html", "Cache-Control": "no-store" },
    redirect: "manual",
    signal: AbortSignal.timeout(22_000),
  });
  const responseBody=(await response.text()).slice(0,150_000);
  process.stdout.write("HTTP "+host+" "+path+" => "+response.status+
    " location="+(response.headers.get("location")||"").slice(0,180)+
    " x-middleware-rewrite="+(response.headers.get("x-middleware-rewrite")||"").slice(0,160)+"\\n");
  return {
    status: response.status,
    location: response.headers.get("location") || "",
    text: responseBody,
  };
}

async function ready() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error("Next server exited before ready");
    try {
      const response = await request(BLUE, "/__bluebelly_qa_ready_probe__");
      if (response.status > 0) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("Next server did not open loopback within readiness deadline");
}

const checks = [];
function check(name, actual, expected) {
  try {
    assert.equal(actual, expected, name);
    checks.push({name, result: "PASS"});
  } catch (error) {
    checks.push({name, result: "FAIL", detail: JSON.stringify({actual,expected})});
  }
}
function checkPublic(name, response, marker) {
  check(name + " HTTP 200", response.status, 200);
  check(name + " rendered page marker", response.text.includes(marker), true);
}
function checkDenied(name, response, expected) {
  check(name + " private status", expected.includes(response.status), true);
  check(name + " no private edition data", response.text.includes("data-bluebelly-exact-edition=\"pinned\""), false);
  check(name + " no owner research JSON", response.text.includes('"thesisVersionId"'), false);
}

try {
  await ready();
  for (const [path, marker] of [
    ["/", "Blue Desk"],
    ["/key-stories", "Key market stories"],
    ["/rates", "US Treasury rates"],
    ["/what-changed", "New catalysts and follow-through"],
    ["/markets", "Markets"],
    ["/calendar", "Market calendar"],
  ]) {
    const response = await request(BLUE, path);
    checkPublic("Bluebelly " + path, response, marker);
  }
  for (const [path, marker] of [
    ["/key-stories", "Key market stories"],
    ["/rates", "US Treasury rates"],
    ["/what-changed", "New catalysts and follow-through"],
  ]) {
    checkPublic("Canonical Live " + path, await request(LIVE, path), marker);
  }

  for (const path of [
    "/presenter",
    "/presenter/full-prep",
    "/presenter/full-prep?edition=" + edition,
  ]) {
    const r = await request(BLUE, path);
    checkDenied("Anonymous Bluebelly " + path, r, [302,303,307,308]);
    check("Anonymous Bluebelly " + path + " login target", r.location.includes("/login"), true);
  }
  for (const path of [
    "/api/presenter/technical-checks",
    "/api/owner/editorial-generate",
  ]) {
    checkDenied("Anonymous owner API " + path, await request(BLUE, path), [401,403,503]);
  }
  for (const path of [
    "/blue-desk/presenter",
    "/blue-desk/presenter/full-prep",
    "/hybrid-output/prepare",
    "/api/owner/bluebelly/v1/overview",
    "/api/cron/research/morning",
  ]) {
    check("Bluebelly raw denied " + path, (await request(BLUE,path)).status, 404);
  }

  // On temporary preview hostnames public-clean routes are not mapped. That
  // is an intentional boundary, not proof of production public-page rendering.
  const preview = await request(PREVIEW,"/key-stories");
  checkDenied("Unapproved preview hostname /key-stories",preview,[302,303,307,308]);
  check("Preview requires app login when no owner session exists",preview.location.includes("/login"),true);

  for(const {name,result,detail} of checks){
    process.stdout.write(`[${result}] ${name}${detail ? ": " + detail : ""}\n`);
  }
  const failed=checks.filter(c=>c.result==="FAIL");
  process.stdout.write(`Bluebelly loopback HTTP: ${checks.length-failed.length}/${checks.length} checks passed.\n`);
  if(failed.length)throw new Error(`${failed.length} loopback route/denial assertions failed`);
}catch(error){
  process.stderr.write("Bluebelly anonymous HTTP smoke failed: "+String(error)+"\n");
  process.stderr.write("Server log tail (redacted by absence of provider env):\n"+output.slice(-1800)+"\n");
  process.exitCode=1;
}finally{
  if(server.exitCode===null){
    server.kill("SIGTERM");
    await Promise.race([once(server,"exit").catch(()=>{}),sleep(4500)]);
    if(server.exitCode===null)server.kill("SIGKILL");
  }
}
