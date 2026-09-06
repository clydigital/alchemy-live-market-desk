#!/usr/bin/env node

/**
 * Local browser companion for the scheduled Live Desk video intake.
 *
 * This process owns a separate Chrome profile and exposes a small,
 * token-protected HTTP contract to the deployment. It is deliberately kept
 * outside Vercel: a serverless function cannot operate a user's desktop
 * Chrome. The process does not use a browser extension, scrape private data,
 * or bypass CAPTCHA / Cloudflare challenges. Those conditions are returned as
 * retryable operational failures to the scheduler.
 */

import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bindHost = process.env.CHROME_TRANSCRIPT_OPERATOR_BIND || "127.0.0.1";
const bindPort = Number(process.env.CHROME_TRANSCRIPT_OPERATOR_PORT || "4317");
const token = (process.env.CHROME_TRANSCRIPT_OPERATOR_TOKEN || "").trim();
const debugPort = Number(process.env.CHROME_TRANSCRIPT_OPERATOR_DEBUG_PORT || "9229");
const debugBaseUrl = (process.env.CHROME_TRANSCRIPT_OPERATOR_DEBUG_URL || `http://127.0.0.1:${debugPort}`).replace(/\/$/, "");
const chromeExecutable = (process.env.CHROME_EXECUTABLE_PATH || "").trim();
const profileDirectory = process.env.CHROME_TRANSCRIPT_OPERATOR_PROFILE_DIR
  || join(tmpdir(), "alchemy-live-browser-operator");
const MAX_BODY_BYTES = 32 * 1024;
const MAX_SEGMENTS = 10_000;
const MAX_TEXT_LENGTH = 1_000_000;

if (!Number.isInteger(bindPort) || bindPort < 1 || bindPort > 65_535) {
  throw new Error("CHROME_TRANSCRIPT_OPERATOR_PORT must be a valid TCP port.");
}
if (!token) {
  throw new Error("CHROME_TRANSCRIPT_OPERATOR_TOKEN is required; the browser operator will not start without it.");
}
if (bindHost !== "127.0.0.1" && bindHost !== "localhost" && bindHost !== "::1" && token.length < 24) {
  throw new Error("A non-loopback browser operator requires a token of at least 24 characters.");
}
if (typeof WebSocket !== "function") {
  throw new Error("This operator requires Node.js 22+ with the built-in WebSocket client.");
}

class OperatorFailure extends Error {
  constructor(message, { code = "browser_operator_unavailable", retryable = true } = {}) {
    super(message);
    this.name = "OperatorFailure";
    this.code = code;
    this.retryable = retryable;
  }
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeText(value, maximum = 1_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validVideoId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
}

function validHandle(value) {
  return typeof value === "string" && /^@[A-Za-z0-9._-]{2,120}$/.test(value);
}

function authorized(request) {
  const header = request.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new OperatorFailure("Operator request body exceeds the limit.", {
      code: "invalid_request",
      retryable: false,
    });
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!isRecord(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new OperatorFailure("Operator request must be a JSON object.", { code: "invalid_request", retryable: false });
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`Chrome DevTools returned HTTP ${response.status}.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Chrome DevTools returned malformed JSON.");
  }
}

let managedChrome = null;

async function debugVersion() {
  return fetchJson(`${debugBaseUrl}/json/version`);
}

async function ensureChrome() {
  try {
    await debugVersion();
    return;
  } catch {
    // A pre-existing debug session is optional. Launch only a dedicated
    // profile so normal user browsing and cookies are never reused.
  }
  if (!chromeExecutable || !existsSync(chromeExecutable)) {
    throw new OperatorFailure(
      "Chrome remote debugging is unavailable. Set CHROME_EXECUTABLE_PATH or start Chrome with the configured debug URL.",
      { code: "browser_operator_unavailable", retryable: true },
    );
  }
  if (!managedChrome) {
    mkdirSync(profileDirectory, { recursive: true });
    managedChrome = spawn(chromeExecutable, [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDirectory}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
    ], { stdio: "ignore", windowsHide: true });
  }
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await pause(250);
    try {
      await debugVersion();
      return;
    } catch {
      // Wait briefly for the dedicated Chrome profile to initialise.
    }
  }
  throw new OperatorFailure("Chrome started but its DevTools endpoint did not become available.", {
    code: "browser_operator_unavailable",
    retryable: true,
  });
}

class CdpSession {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.opened = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", () => resolve());
      this.socket.addEventListener("error", () => reject(new Error("Chrome DevTools WebSocket connection failed.")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timeout);
      if (message.error) pending.reject(new Error(message.error.message || "Chrome DevTools command failed."));
      else pending.resolve(message.result || {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Chrome DevTools WebSocket closed unexpectedly."));
      }
      this.pending.clear();
    });
  }

  async command(method, params = {}) {
    await this.opened;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome DevTools command timed out: ${method}.`));
      }, 15_000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.command("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Page evaluation failed.");
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function openPage(url) {
  await ensureChrome();
  const target = await fetchJson(`${debugBaseUrl}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!target?.id || !target?.webSocketDebuggerUrl) throw new Error("Chrome DevTools did not create a browser page.");
  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.command("Page.enable");
  await session.command("Runtime.enable");
  return { target, session };
}

async function closePage(target, session) {
  session?.close();
  if (!target?.id) return;
  try {
    await fetch(`${debugBaseUrl}/json/close/${encodeURIComponent(target.id)}`, { cache: "no-store" });
  } catch {
    // A transient close error must not conceal the operator result.
  }
}

async function navigateAndWait(session, url) {
  await session.command("Page.navigate", { url });
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const readyState = await session.evaluate("document.readyState");
    if (readyState === "interactive" || readyState === "complete") return;
    await pause(250);
  }
  throw new OperatorFailure("Chrome navigation did not become interactive in time.", {
    code: "timeout",
    retryable: true,
  });
}

function verificationFailure(snapshot, destination) {
  const text = safeText(snapshot?.bodyText, 5_000).toLowerCase();
  if (/performing security verification|just a moment|verify you are human|unusual traffic|captcha/.test(text)) {
    return new OperatorFailure(`${destination} presented a browser verification challenge; no bypass was attempted.`, {
      code: "browser_verification_required",
      retryable: true,
    });
  }
  return null;
}

async function youtubeWatchSnapshot(session, videoId) {
  await navigateAndWait(session, `https://www.youtube.com/watch?v=${videoId}`);
  const snapshot = await session.evaluate(`(() => ({
    bodyText: (document.body?.innerText || '').slice(0, 12000),
    title: document.querySelector('meta[name="title"]')?.content || document.title || '',
    channel: document.querySelector('ytd-channel-name a')?.textContent || '',
    channelUrl: document.querySelector('ytd-channel-name a')?.href || ''
  }))()`);
  const verification = verificationFailure(snapshot, "YouTube");
  if (verification) throw verification;
  return {
    title: safeText(snapshot?.title),
    channel: safeText(snapshot?.channel),
    channelUrl: safeText(snapshot?.channelUrl),
  };
}

async function transcriptSnapshot(session, videoId) {
  const transcriptUrl = `https://youtubetotranscript.com/transcript?v=${encodeURIComponent(videoId)}&current_language_code=en`;
  await navigateAndWait(session, transcriptUrl);
  const snapshot = await session.evaluate(`(() => {
    const bodyText = (document.body?.innerText || '').replace(/\\r/g, '').slice(0, ${MAX_TEXT_LENGTH});
    const lower = bodyText.toLowerCase();
    if (/performing security verification|just a moment|verify you are human|unusual traffic|captcha/.test(lower)) {
      return { state: 'blocked', bodyText, sourceUrl: location.href };
    }
    const lines = bodyText.split(/\\n+/).map((line) => line.trim()).filter(Boolean);
    const timeExpression = /^(?:\\[)?(?:(\\d{1,2}):)?([0-5]\\d):([0-5]\\d)(?:\\])?(?:\\s+|\\s*[-–]\\s*)(.+)?$/;
    const segments = [];
    let active = null;
    const finishActive = () => {
      if (active && active.text.trim()) segments.push({ startSeconds: active.startSeconds, text: active.text.trim() });
      active = null;
    };
    for (const line of lines) {
      const match = timeExpression.exec(line);
      if (match) {
        finishActive();
        active = {
          startSeconds: Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]),
          text: match[4] || ''
        };
      } else if (active) {
        active.text = (active.text + ' ' + line).trim();
      }
    }
    finishActive();
    const capped = segments.slice(0, ${MAX_SEGMENTS});
    return {
      state: capped.length ? 'ready' : 'empty',
      bodyText: bodyText.slice(0, 12000),
      sourceUrl: location.href,
      language: document.documentElement.lang || 'en',
      segments: capped,
    };
  })()`);
  const verification = verificationFailure(snapshot, "YouTubeToTranscript");
  if (verification || snapshot?.state === "blocked") throw verification || new OperatorFailure(
    "YouTubeToTranscript presented a browser verification challenge; no bypass was attempted.",
    { code: "browser_verification_required", retryable: true },
  );
  if (snapshot?.state !== "ready" || !Array.isArray(snapshot.segments)) {
    throw new OperatorFailure("YouTubeToTranscript did not expose a timestamped transcript for this video.", {
      code: "transcript_missing",
      retryable: false,
    });
  }
  const segments = snapshot.segments.flatMap((segment, index, entries) => {
    const startSeconds = Number(segment?.startSeconds);
    const text = safeText(segment?.text, 10_000);
    const nextStart = Number(entries[index + 1]?.startSeconds);
    const durationSeconds = Number.isFinite(nextStart) && nextStart >= startSeconds ? nextStart - startSeconds : 0;
    if (!Number.isFinite(startSeconds) || startSeconds < 0 || !text) return [];
    return [{ startSeconds, durationSeconds, endSeconds: startSeconds + durationSeconds, text }];
  });
  if (!segments.length) {
    throw new OperatorFailure("YouTubeToTranscript returned transcript rows without usable timestamped text.", {
      code: "transcript_missing",
      retryable: false,
    });
  }
  return {
    sourceUrl: safeText(snapshot.sourceUrl, 2_000),
    language: safeText(snapshot.language, 32) || "en",
    segments,
    text: segments.map((segment) => segment.text).join(" ").slice(0, MAX_TEXT_LENGTH),
    durationSeconds: Math.ceil(Math.max(...segments.map((segment) => segment.endSeconds))),
  };
}

async function discoverChannelSnapshot(session, channel) {
  const videosUrl = `https://www.youtube.com/${channel.handle}/videos`;
  await navigateAndWait(session, videosUrl);
  const snapshot = await session.evaluate(`(() => {
    const bodyText = (document.body?.innerText || '').slice(0, 12000);
    const lower = bodyText.toLowerCase();
    if (/performing security verification|just a moment|verify you are human|unusual traffic|captcha/.test(lower)) {
      return { state: 'blocked', bodyText };
    }
    const cards = [...document.querySelectorAll('ytd-rich-grid-media, ytd-grid-video-renderer')];
    const videos = cards.map((card) => {
      const anchor = card.querySelector('a#video-title-link, a#video-title');
      const href = anchor?.href || '';
      const id = /[?&]v=([A-Za-z0-9_-]{11})/.exec(href)?.[1] || '';
      const metadata = [...card.querySelectorAll('#metadata-line span, #metadata span')]
        .map((node) => (node.textContent || '').trim()).filter(Boolean);
      const allText = (card.innerText || '').replace(/\\s+/g, ' ').trim();
      const publishedLabel = metadata.find((value) => /\\bago\\b/i.test(value)) || '';
      return {
        videoId: id,
        title: (anchor?.textContent || '').trim(),
        url: href,
        publishedLabel,
        isLive: /\\b(live|streamed)\\b/i.test(allText),
        isShort: /\\/shorts\\//i.test(href),
      };
    }).filter((video) => video.videoId && video.title && video.url);
    return { state: 'ready', videos, scannedCount: cards.length };
  })()`);
  const verification = verificationFailure(snapshot, "YouTube");
  if (verification || snapshot?.state === "blocked") throw verification || new OperatorFailure(
    "YouTube presented a browser verification challenge; no bypass was attempted.",
    { code: "browser_verification_required", retryable: true },
  );
  return {
    channelId: "",
    scannedCount: Number.isInteger(snapshot?.scannedCount) ? snapshot.scannedCount : 0,
    videos: Array.isArray(snapshot?.videos) ? snapshot.videos.slice(0, 30) : [],
  };
}

let operationTail = Promise.resolve();
function serialiseOperation(task) {
  const next = operationTail.then(task, task);
  operationTail = next.catch(() => undefined);
  return next;
}

async function operation(body) {
  if (body.operation === "transcript") {
    const videoId = body.videoId;
    if (!validVideoId(videoId)) throw new OperatorFailure("A valid eleven-character YouTube video ID is required.", {
      code: "invalid_video_url",
      retryable: false,
    });
    const { target, session } = await openPage("about:blank");
    try {
      const video = await youtubeWatchSnapshot(session, videoId);
      const transcript = await transcriptSnapshot(session, videoId);
      return {
        status: "ready",
        observedAt: new Date().toISOString(),
        video,
        transcript,
      };
    } finally {
      await closePage(target, session);
    }
  }
  if (body.operation === "discover") {
    const channel = body.channel;
    if (!isRecord(channel) || !safeText(channel.channelKey, 120) || !safeText(channel.channelName, 200) || !validHandle(channel.handle)) {
      throw new OperatorFailure("A channel key, channel name, and YouTube handle are required for discovery.", {
        code: "invalid_request",
        retryable: false,
      });
    }
    const { target, session } = await openPage("about:blank");
    try {
      const discovered = await discoverChannelSnapshot(session, channel);
      return { status: "ready", observedAt: new Date().toISOString(), channel: discovered };
    } finally {
      await closePage(target, session);
    }
  }
  throw new OperatorFailure("Operator 'operation' must be 'discover' or 'transcript'.", {
    code: "invalid_request",
    retryable: false,
  });
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url?.split("?")[0] !== "/v1/transcript") {
    sendJson(response, 404, { status: "unavailable", code: "not_found", message: "Use POST /v1/transcript." });
    return;
  }
  if (!authorized(request)) {
    sendJson(response, 401, { status: "unavailable", code: "operator_auth_error", message: "Unauthorized browser operator request." });
    return;
  }
  try {
    const body = await readJson(request);
    const result = await serialiseOperation(() => operation(body));
    sendJson(response, 200, result);
  } catch (error) {
    const failure = error instanceof OperatorFailure
      ? error
      : new OperatorFailure(error instanceof Error ? error.message : "Unknown browser operator failure.");
    sendJson(response, 200, {
      status: "unavailable",
      code: failure.code,
      message: failure.message.slice(0, 1_000),
      retryable: failure.retryable,
    });
  }
});

server.listen(bindPort, bindHost, () => {
  console.log(`Chrome transcript operator listening on http://${bindHost}:${bindPort}/v1/transcript`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
