/**
 * Private on-demand preview of X account feeds through the documented free
 * FxEmbed API. This is NOT persisted/canonical ingestion or a scheduled task.
 */
import {
  X_CORE_ROSTER, X_SWEEP_DEFAULTS, isExcludedXWireHandle, selectXSweepCandidates, xSourceHealth,
  xSweepWindow, type XCandidate, type XAccountAttempt,
} from "./x-sweep-core.ts";

const PROVIDER = "https://api.fxtwitter.com";
const PAGE_SIZE = 50;
const MAX_BODY = 1_000_000;
const TIMEOUT_MS = 7_000;
type Rec = Record<string, unknown>;
const rec = (value: unknown): Rec => value && typeof value === "object" && !Array.isArray(value) ? value as Rec : {};
const str = (value: unknown, max = 2000): string => typeof value === "string" ? value.trim().slice(0, max) : "";
function published(row: Rec): string | null {
  const parsed = Date.parse(str(row.created_at, 100));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  const n = row.created_timestamp;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  const ms = n >= 1_000_000_000_000 ? n : n * 1000;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
export type XWirePost = {
  id: string; url: string; handle: string; publishedAt: string; text: string;
  images: string[]; quoteUrl: string | null; attribution: "THIRD_PARTY_ONLY";
};
export type XWirePreview = {
  provider: string; retrievedAt: string; window: ReturnType<typeof xSweepWindow>;
  posts: XWirePost[]; accounts: XAccountAttempt[]; health: ReturnType<typeof xSourceHealth>;
  deferredCount: number; withheldCount: number; disclaimer: string;
};
type AccountData = { account: XAccountAttempt; candidates: XCandidate[]; detail: Map<string, XWirePost> };
async function readAccount(handle: string, startAt: string, now: string, fetchImpl: typeof fetch): Promise<AccountData> {
  if (isExcludedXWireHandle(handle)) throw new Error("X Wire source explicitly excluded");
  const base: XAccountAttempt = {
    handle, status: "unavailable", attemptedAt: new Date().toISOString(),
    lastSuccessAt: null, lastObservedPostAt: null, fetched: 0, newPosts: 0, error: null,
  };
  const empty = (account: XAccountAttempt): AccountData => ({ account, candidates: [], detail: new Map() });
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return empty({ ...base, error: "Invalid registered handle" });
  const since = Math.floor(Date.parse(startAt) / 1000);
  const uri = PROVIDER + "/2/profile/" + handle + "/statuses?count=" + PAGE_SIZE + "&since=" + since;
  try {
    const response = await fetchImpl(uri, {
      headers: { Accept: "application/json" }, cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 204) return empty({ ...base, status: "healthy", lastSuccessAt: new Date().toISOString() });
    if (!response.ok) return empty({
      ...base, status: [401, 403, 429].includes(response.status) ? "blocked" : "unavailable",
      error: "HTTP " + response.status,
    });
    if (!(response.headers.get("content-type") || "").includes("json"))
      return empty({ ...base, status: "partial", error: "Provider did not return JSON" });
    const raw = await response.text();
    if (raw.length > MAX_BODY) return empty({ ...base, status: "partial", error: "Provider body exceeds size limit" });
    const json = rec(JSON.parse(raw));
    if (json.code !== 200 || !Array.isArray(json.results))
      return empty({ ...base, status: "partial", error: "Unexpected provider envelope" });
    const candidates: XCandidate[] = [];
    const detail = new Map<string, XWirePost>();
    let withheld = 0;
    const retrievedAt = new Date().toISOString();
    for (const row of json.results.slice(0, PAGE_SIZE)) {
      const item = rec(row), author = rec(item.author);
      const id = str(item.id, 25), screen = str(author.screen_name, 20);
      const date = published(item), body = str(item.text);
      if (item.type !== "status" || !/^\d{6,25}$/.test(id) ||
          screen.toLowerCase() !== handle.toLowerCase() ||
          !date || Date.parse(date) > Date.parse(now) + 300_000 || !body) { withheld++; continue; }
      const url = "https://x.com/" + screen + "/status/" + id;
      const quote = rec(item.quote), quoteId = str(quote.id, 25), quoteUser = str(rec(quote.author).screen_name, 20);
      const quoteUrl = !isExcludedXWireHandle(quoteUser) && /^\d{6,25}$/.test(quoteId) && /^[A-Za-z0-9_]{1,15}$/.test(quoteUser)
        ? "https://x.com/" + quoteUser + "/status/" + quoteId : null;
      const photos = rec(item.media).photos;
      const images = Array.isArray(photos) ? photos.map(photo => str(rec(photo).url, 600))
        .filter(url => url.startsWith("https://")).slice(0, 4) : [];
      candidates.push({
        postUrl: url, accountHandle: handle, publishedAt: date,
        retrievedAt, importance: 50, type: item.reposted_by ? "repost" : item.quote ? "quote" : "post",
      });
      detail.set(id, { id, url, handle: screen, publishedAt: date, text: body,
        images, quoteUrl, attribution: "THIRD_PARTY_ONLY" });
    }
    const times = candidates.map(item => Date.parse(item.publishedAt!));
    const oldest = times.length ? Math.min(...times) : Infinity;
    const incomplete = Boolean(rec(json.cursor).bottom) && oldest >= Date.parse(startAt);
    const account: XAccountAttempt = {
      ...base, status: incomplete || withheld > 0 ? "partial" : "healthy",
      lastSuccessAt: retrievedAt, fetched: json.results.length, newPosts: candidates.length,
      lastObservedPostAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
      error: incomplete ? "Possible missing in-window posts after first page; no durable backlog"
        : withheld ? withheld + " unattributed or malformed row(s) withheld" : null,
    };
    return { account, candidates, detail };
  } catch (e) {
    return empty({ ...base, error: e instanceof Error ? e.message.slice(0, 140) : "Provider request failed" });
  }
}
export async function fetchXWirePreview(opts: { nowIso?: string; fetchImpl?: typeof fetch } = {}): Promise<XWirePreview> {
  const now = opts.nowIso ?? new Date().toISOString();
  const window = xSweepWindow(now, null, X_SWEEP_DEFAULTS);
  const results: AccountData[] = new Array(X_CORE_ROSTER.length);
  const fetchImpl = opts.fetchImpl ?? fetch;
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < X_CORE_ROSTER.length) {
      const i = next++;
      results[i] = await readAccount(X_CORE_ROSTER[i].handle, window.startAt, now, fetchImpl);
    }
  }));
  const screened = selectXSweepCandidates(results.flatMap(x => x.candidates), now, X_SWEEP_DEFAULTS);
  const byId = new Map(results.flatMap(x => [...x.detail]));
  const posts = screened.selected.flatMap(row => {
    const post = byId.get(row.postId);
    return post ? [post] : [];
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const accounts = results.map(x => x.account);
  return {
    provider: PROVIDER, retrievedAt: new Date().toISOString(), window, posts, accounts,
    health: xSourceHealth(accounts), deferredCount: screened.deferred.length,
    withheldCount: screened.withheld.length,
    disclaimer: "Owner-only on-demand third-party preview. Fetch success is not X-original verification or complete historical coverage. No persisted checkpoint, backfill, canonical evidence or new scheduled ingestion.",
  };
}
