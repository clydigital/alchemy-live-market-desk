import { createHash } from "node:crypto";

import { type IntakeItemInput, type SourceCheckInput } from "@/lib/research-update";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PROVIDER = "x_syndication_embed";
const WINDOW_MS = 36 * 60 * 60 * 1_000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_POSTS_PER_ACCOUNT = 8;
const MAX_CONCURRENCY = 2;
const TWITTER_EPOCH_MS = 1_288_834_974_657n;

type JsonRecord = Record<string, unknown>;

type XSourceRegistryRow = {
  id: string;
  slug: string;
  name: string;
  x_handle: string | null;
  source_classification: string | null;
  monitored: boolean;
  health_state: string | null;
};

export type ParsedXPost = {
  postId: string;
  authorHandle: string;
  authorDisplayName: string;
  text: string;
  postedAt: string;
  canonicalUrl: string;
  media: Array<Record<string, unknown>>;
  links: string[];
  threadContext: Record<string, unknown>;
  isRetweet: boolean;
  isQuote: boolean;
  rawPayload: Record<string, unknown>;
};

type SourceFetchResult = {
  source: XSourceRegistryRow;
  ok: boolean;
  healthState: "healthy" | "no_new_posts" | "rate_limited" | "blocked" | "unavailable" | "renamed_unresolved";
  retryable: boolean;
  note: string;
  seen: number;
  posts: ParsedXPost[];
};

type AcquisitionOptions = {
  now?: Date;
  fetchImpl?: typeof fetch;
};

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function at(value: unknown, ...path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    const row = record(current);
    if (!row) return undefined;
    current = row[key];
  }
  return current;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function decodeScriptText(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function extractSyndicationPayload(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const match = body.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) throw new Error("X syndication response did not contain __NEXT_DATA__.");
  return JSON.parse(decodeScriptText(match[1]));
}

function snowflakeDate(postId: string): string | null {
  try {
    const value = BigInt(postId);
    const timestamp = Number((value >> 22n) + TWITTER_EPOCH_MS);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  } catch {
    return null;
  }
}

function authorFromNode(node: JsonRecord) {
  const user = record(at(node, "core", "user_results", "result"))
    ?? record(at(node, "core", "user_result", "result"))
    ?? record(node.user)
    ?? null;
  const legacy = record(user?.legacy) ?? user;
  return {
    handle: text(legacy?.screen_name) || text(legacy?.username),
    displayName: text(legacy?.name),
  };
}

function mediaFromLegacy(legacy: JsonRecord) {
  const rows = array(at(legacy, "extended_entities", "media"));
  return rows.flatMap((value): Array<Record<string, unknown>> => {
    const item = record(value);
    if (!item) return [];
    const mediaUrl = text(item.media_url_https) || text(item.media_url);
    const expandedUrl = text(item.expanded_url) || text(item.url);
    const variants = array(at(item, "video_info", "variants")).flatMap((variant): Array<Record<string, unknown>> => {
      const row = record(variant);
      if (!row) return [];
      const url = text(row.url);
      if (!url) return [];
      return [{ url, contentType: text(row.content_type), bitrate: typeof row.bitrate === "number" ? row.bitrate : null }];
    });
    return [{
      type: text(item.type) || "unknown",
      mediaUrl: mediaUrl || null,
      expandedUrl: expandedUrl || null,
      width: typeof at(item, "original_info", "width") === "number" ? at(item, "original_info", "width") : null,
      height: typeof at(item, "original_info", "height") === "number" ? at(item, "original_info", "height") : null,
      variants,
    }];
  });
}

function linksFromLegacy(legacy: JsonRecord) {
  return unique(array(at(legacy, "entities", "urls")).flatMap((value): string[] => {
    const row = record(value);
    const url = text(row?.expanded_url) || text(row?.unwound_url) || text(row?.url);
    return url.startsWith("https://") ? [url] : [];
  }));
}

function parseTweetNode(value: unknown): ParsedXPost | null {
  const node = record(value);
  if (!node) return null;
  const legacy = record(node.legacy) ?? node;
  const postId = text(node.rest_id) || text(legacy.id_str) || text(node.id_str);
  const postText = text(legacy.full_text) || text(legacy.text) || text(node.full_text);
  if (!postId || !postText) return null;

  const author = authorFromNode(node);
  if (!author.handle) return null;
  const rawDate = text(legacy.created_at) || text(node.created_at);
  const parsedDate = rawDate ? Date.parse(rawDate) : Number.NaN;
  const postedAt = Number.isFinite(parsedDate) ? new Date(parsedDate).toISOString() : snowflakeDate(postId);
  if (!postedAt) return null;

  const isRetweet = /^RT\s+@/i.test(postText)
    || Boolean(legacy.retweeted_status_result)
    || Boolean(node.retweeted_status_result);
  const quoteId = text(at(node, "quoted_status_result", "result", "rest_id"))
    || text(at(legacy, "quoted_status_result", "result", "rest_id"));
  const conversationId = text(legacy.conversation_id_str) || text(node.conversation_id_str);
  const replyToId = text(legacy.in_reply_to_status_id_str);
  const replyToHandle = text(legacy.in_reply_to_screen_name);
  const authorHandle = author.handle.replace(/^@/, "");

  return {
    postId,
    authorHandle,
    authorDisplayName: author.displayName || `@${authorHandle}`,
    text: postText,
    postedAt,
    canonicalUrl: `https://x.com/${encodeURIComponent(authorHandle)}/status/${postId}`,
    media: mediaFromLegacy(legacy),
    links: linksFromLegacy(legacy),
    threadContext: {
      conversationId: conversationId || null,
      replyToPostId: replyToId || null,
      replyToHandle: replyToHandle || null,
      quotedPostId: quoteId || null,
    },
    isRetweet,
    isQuote: Boolean(quoteId),
    rawPayload: node,
  };
}

function walk(value: unknown, visit: (value: unknown) => void, seen = new Set<object>()) {
  if (value === null || typeof value !== "object") return;
  const objectValue = value as object;
  if (seen.has(objectValue)) return;
  seen.add(objectValue);
  visit(value);
  if (Array.isArray(value)) {
    for (const child of value) walk(child, visit, seen);
    return;
  }
  for (const child of Object.values(value as JsonRecord)) walk(child, visit, seen);
}

export function parseSyndicationTimelinePayload(payload: unknown): ParsedXPost[] {
  const posts = new Map<string, ParsedXPost>();
  walk(payload, (value) => {
    const post = parseTweetNode(value);
    if (!post) return;
    const key = `${post.authorHandle.toLowerCase()}:${post.postId}`;
    if (!posts.has(key)) posts.set(key, post);
  });
  return [...posts.values()].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function marketScores(postText: string) {
  const value = postText.toLowerCase();
  const macro = /\b(fed|fomc|rates?|yield|treasury|inflation|cpi|pce|payroll|jobs?|unemployment|dollar|usd|yen|jpy|boj|ecb|tariff|sanction|oil|crude|brent|wti|diesel|gas|opec|iran|hormuz|war|missile|earnings|guidance|revenue|capex|bitcoin|btc|gold|china|jgb|credit|spread|liquidity)\b/g;
  const assets = /\b(spx|s&p|nasdaq|ndx|dow|dxy|ust|us10y|us2y|vix|xau|xag|btc|eth|nvda|tsla|mstr|mu|oil|brent|wti)\b/g;
  const macroHits = (value.match(macro) || []).length;
  const assetHits = (value.match(assets) || []).length;
  const urgency = /\b(breaking|just in|halt|attack|strike|emergency|surprise|unexpected|record|highest|lowest|cut|hike|default|downgrade)\b/i.test(value);
  return {
    relevance: Math.min(88, 52 + macroHits * 6 + assetHits * 4),
    materiality: Math.min(88, 46 + macroHits * 5 + assetHits * 5 + (urgency ? 12 : 0)),
  };
}

export function xPostToIntakeItem(post: ParsedXPost): IntakeItemInput | null {
  if (post.isRetweet && !post.isQuote) return null;
  const contentHash = hash(`${post.authorHandle.toLowerCase()}|${post.postId}|${post.text}`);
  const scores = marketScores(post.text);
  const material = scores.materiality >= 64 && scores.relevance >= 58;
  const metadata = {
    provider: PROVIDER,
    handle: post.authorHandle,
    postId: post.postId,
    verificationState: "attributed",
    sourceVerificationRole: "discovery_only",
    media: post.media,
    links: post.links,
    threadContext: post.threadContext,
    isQuote: post.isQuote,
  };
  return {
    itemKey: `x:${post.postId}:${contentHash.slice(0, 16)}`,
    itemType: "social_post",
    publisher: `X @${post.authorHandle}`,
    externalId: post.postId,
    title: `@${post.authorHandle}: ${post.text.replace(/\s+/g, " ").slice(0, 180)}`,
    url: post.canonicalUrl,
    publishedAt: post.postedAt,
    summary: `Attributed X post from @${post.authorHandle}. ${post.text}`.slice(0, 2_000),
    sourceQuality: 52,
    relevance: scores.relevance,
    novelty: 72,
    materiality: scores.materiality,
    recommendedAction: material ? "collect_evidence" : "monitor",
    newsSignal: "Attributed X/social statement. Discovery-only until independently corroborated.",
    divergenceKind: material ? "news_lead" : "none",
    divergenceNote: `xSocial:${JSON.stringify(metadata)}`,
    evidence: [{
      title: `X post by @${post.authorHandle}`,
      url: post.canonicalUrl,
      publisher: `X @${post.authorHandle}`,
      publishedAt: post.postedAt,
      claim: `@${post.authorHandle} posted on X: ${post.text}`.slice(0, 1_000),
    }],
    reviewReason: "The post proves only that the attributed account published this statement. Treat the underlying claim as discovery until independently corroborated by canonical evidence.",
  };
}

function retryAfterMs(response: Response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return 400;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(200, Math.min(2_000, seconds * 1_000));
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(200, Math.min(2_000, date - Date.now())) : 400;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTimeline(handle: string, fetchImpl: typeof fetch) {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/json;q=0.9",
          "User-Agent": "Mozilla/5.0 (compatible; AlchemyLiveMarketDesk/1.0; +https://alchemymarkets.com/)",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      lastStatus = response.status;
      if (response.status === 429 && attempt === 0) {
        await sleep(retryAfterMs(response));
        continue;
      }
      if (response.status === 404) return { ok: false as const, state: "unavailable" as const, retryable: false, detail: "HTTP 404" };
      if (response.status === 429) return { ok: false as const, state: "rate_limited" as const, retryable: true, detail: "HTTP 429" };
      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) { await sleep(350); continue; }
        return { ok: false as const, state: "blocked" as const, retryable: response.status >= 500, detail: `HTTP ${response.status}` };
      }
      const body = await response.text();
      const payload = extractSyndicationPayload(body);
      return { ok: true as const, posts: parseSyndicationTimelinePayload(payload) };
    } catch (error) {
      if (attempt === 0) { await sleep(350); continue; }
      return { ok: false as const, state: "blocked" as const, retryable: true, detail: error instanceof Error ? error.message.slice(0, 180) : `HTTP ${lastStatus || "unknown"}` };
    }
  }
  return { ok: false as const, state: "blocked" as const, retryable: true, detail: `HTTP ${lastStatus || "unknown"}` };
}

async function updateSourceHealth(client: ReturnType<typeof createSupabaseAdminClient>, result: SourceFetchResult, now: Date) {
  const latest = result.posts[0]?.postedAt ?? null;
  const payload: Record<string, unknown> = {
    health_state: result.healthState,
    ingestion_provider: PROVIDER,
    provider_metadata: {
      provider: PROVIDER,
      retryable: result.retryable,
      note: result.note,
      postsSeen: result.seen,
      postsFresh: result.posts.length,
      checkedAt: now.toISOString(),
      verificationRole: "discovery_only",
    },
    updated_at: now.toISOString(),
  };
  if (result.ok) payload.last_successful_check_at = now.toISOString();
  if (latest) payload.last_post_seen_at = latest;
  const { error } = await client.from("research_source_registry").update(payload).eq("id", result.source.id);
  if (error) throw new Error(`Could not persist X source health for @${result.source.x_handle}: ${error.message}`);
}

async function fetchSource(source: XSourceRegistryRow, now: Date, fetchImpl: typeof fetch): Promise<SourceFetchResult> {
  const handle = text(source.x_handle).replace(/^@/, "");
  if (!handle) return { source, ok: false, healthState: "unavailable", retryable: false, note: "Registry row has no X handle.", seen: 0, posts: [] };
  const fetched = await fetchTimeline(handle, fetchImpl);
  if (!fetched.ok) return { source, ok: false, healthState: fetched.state, retryable: fetched.retryable, note: fetched.detail, seen: 0, posts: [] };

  const expected = handle.toLowerCase();
  const matching = fetched.posts.filter((post) => post.authorHandle.toLowerCase() === expected);
  if (!matching.length && fetched.posts.length) {
    return {
      source,
      ok: false,
      healthState: "renamed_unresolved",
      retryable: false,
      note: `Timeline resolved but no post author matched @${handle}; source identity requires review.`,
      seen: fetched.posts.length,
      posts: [],
    };
  }
  const fresh = matching.filter((post) => {
    const time = Date.parse(post.postedAt);
    return time >= now.getTime() - WINDOW_MS && time <= now.getTime() + FUTURE_TOLERANCE_MS;
  }).slice(0, MAX_POSTS_PER_ACCOUNT);
  return {
    source,
    ok: true,
    healthState: fresh.length ? "healthy" : "no_new_posts",
    retryable: false,
    note: fresh.length ? `${fresh.length} post(s) inside the 36-hour window.` : "Timeline checked; no new posts inside the 36-hour window.",
    seen: matching.length,
    posts: fresh,
  };
}

async function parallelMap<T, R>(values: T[], limit: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

export async function acquireXSocialPosts(options: AcquisitionOptions = {}): Promise<{ check: SourceCheckInput; items: IntakeItemInput[] }> {
  const now = options.now ?? new Date();
  const fetchImpl = options.fetchImpl ?? fetch;
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("research_source_registry")
    .select("id,slug,name,x_handle,source_classification,monitored,health_state")
    .eq("source_kind", "social_monitor")
    .eq("monitored", true)
    .eq("status", "active")
    .order("slug", { ascending: true });
  if (error) {
    return { check: { source: "x-social", status: "blocked", itemCount: 0, retryable: true, note: `X source registry unavailable: ${error.message.slice(0, 260)}` }, items: [] };
  }
  const sources = (data ?? []) as XSourceRegistryRow[];
  if (!sources.length) {
    return { check: { source: "x-social", status: "blocked", itemCount: 0, retryable: false, note: "X social registry is unconfigured; no active monitored sources were found." }, items: [] };
  }

  const results = await parallelMap(sources, MAX_CONCURRENCY, (source) => fetchSource(source, now, fetchImpl));
  try {
    for (const result of results) await updateSourceHealth(client, result, now);
  } catch (healthError) {
    return { check: { source: "x-social", status: "blocked", itemCount: 0, retryable: true, note: healthError instanceof Error ? healthError.message.slice(0, 320) : "X source health persistence failed." }, items: [] };
  }

  const rawPosts = results.flatMap((result) => result.posts.map((post) => ({ source: result.source, post })));
  if (rawPosts.length) {
    const rows = rawPosts.map(({ source, post }) => ({
      source_registry_id: source.id,
      provider: PROVIDER,
      post_id: post.postId,
      account_handle: post.authorHandle,
      account_display_name: post.authorDisplayName,
      canonical_url: post.canonicalUrl,
      posted_at: post.postedAt,
      post_text: post.text,
      content_hash: hash(`${post.authorHandle.toLowerCase()}|${post.postId}|${post.text}`),
      media: post.media,
      links: post.links,
      thread_context: { ...post.threadContext, isRetweet: post.isRetweet, isQuote: post.isQuote },
      raw_payload: post.rawPayload,
      verification_state: "attributed",
      last_seen_at: now.toISOString(),
    }));
    const { error: persistError } = await client
      .from("research_social_posts")
      .upsert(rows, { onConflict: "provider,post_id,content_hash", ignoreDuplicates: true });
    if (persistError) {
      return { check: { source: "x-social", status: "blocked", itemCount: 0, retryable: true, note: `X raw-post persistence failed: ${persistError.message.slice(0, 280)}` }, items: [] };
    }
  }

  const items = rawPosts.flatMap(({ post }) => {
    const item = xPostToIntakeItem(post);
    return item ? [item] : [];
  });
  const healthy = results.filter((result) => result.ok).length;
  const failed = results.length - healthy;
  const failures = results.filter((result) => !result.ok).map((result) => `@${result.source.x_handle}:${result.healthState}`).join(", ");
  const note = `X accounts checked ${results.length}; healthy ${healthy}; failed ${failed}; fresh posts ${rawPosts.length}; retained ${items.length}.${failures ? ` Failures: ${failures}.` : ""}`;
  if (!healthy) {
    return { check: { source: "x-social", status: "blocked", itemCount: 0, retryable: results.some((result) => result.retryable), note }, items: [] };
  }
  return {
    check: {
      source: "x-social",
      status: items.length ? "checked" : "no_new_items",
      itemCount: items.length,
      note,
    },
    items,
  };
}
