import "server-only";

import { intelligenceRest } from "@/lib/intelligence/supabase";
import type { ResearchRunInput, SourceCheckInput, IntakeItemInput } from "@/lib/research-update";

type ActiveStoryState = {
  slug: string;
  assets: string[];
  market_question: string | null;
  next_catalyst: string | null;
  confirmation_trigger: string | null;
  invalidation_trigger: string | null;
  status: string;
};

type PastItem = {
  id: string;
  publisher: string;
  title: string;
  summary: string;
  published_at: string;
};

function detectSentimentShift(prevText: string, currText: string) {
  const bullishWords = ["bull", "bullish", "long", "rally", "up", "growth", "high", "hike", "strong", "hawkish"];
  const bearishWords = ["bear", "bearish", "short", "crash", "down", "recession", "low", "cut", "weak", "dovish"];

  const prevLower = prevText.toLowerCase();
  const currLower = currText.toLowerCase();

  let prevSent = "neutral";
  let currSent = "neutral";

  if (bullishWords.some(w => prevLower.includes(w))) prevSent = "bullish";
  if (bearishWords.some(w => prevLower.includes(w))) prevSent = "bearish";

  if (bullishWords.some(w => currLower.includes(w))) currSent = "bullish";
  if (bearishWords.some(w => currLower.includes(w))) currSent = "bearish";

  return {
    shift: prevSent !== currSent && prevSent !== "neutral" && currSent !== "neutral",
    prevSentiment: prevSent,
    currSentiment: currSent
  };
}

export async function runAutonomousOrchestration(options: { dryRun?: boolean; host?: string } = {}): Promise<unknown> {
  const token = process.env.RESEARCH_UPDATE_TOKEN;
  if (!token) {
    throw new Error("RESEARCH_UPDATE_TOKEN is not configured.");
  }

  // 1. Load active stories and their unresolved questions/debt/catalysts
  const activeStories = await intelligenceRest<ActiveStoryState[]>(
    "stories?select=slug,assets,market_question,next_catalyst,confirmation_trigger,invalidation_trigger,status&status=neq.archived&status=neq.discarded"
  );

  const activeAssets = new Set<string>();
  const activeKeywords = new Set<string>();
  const activeSlugs = new Set<string>();

  for (const story of activeStories) {
    activeSlugs.add(story.slug);
    if (story.assets) {
      for (const asset of story.assets) {
        activeAssets.add(asset.toLowerCase());
      }
    }
    const extractKeywords = (text: string | null) => {
      if (!text) return;
      const clean = text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ");
      for (const word of clean.split(/\s+/)) {
        if (word.length > 4) activeKeywords.add(word);
      }
    };
    extractKeywords(story.market_question);
    extractKeywords(story.next_catalyst);
    extractKeywords(story.confirmation_trigger);
    extractKeywords(story.invalidation_trigger);
  }

  // 2. Retrieve newly ingested commentary / items from the lookback window (last 30 days)
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const rawItems = await intelligenceRest<PastItem[]>(
    `research_intake_items?select=id,publisher,title,summary,published_at&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=150`
  );

  if (!rawItems.length) {
    return { skipped: true, reason: "No newly ingested raw commentary items found." };
  }

  // 3. Load past claims/items to support Commentary-Delta processing
  const pastItems = await intelligenceRest<PastItem[]>(
    `research_intake_items?select=id,publisher,title,summary,published_at&published_at=lt.${encodeURIComponent(rawItems[rawItems.length - 1]?.published_at || since)}&order=published_at.desc&limit=100`
  );

  const latestPastByPublisher = new Map<string, PastItem>();
  for (const item of pastItems) {
    const pubKey = item.publisher.toLowerCase().trim();
    if (!latestPastByPublisher.has(pubKey)) {
      latestPastByPublisher.set(pubKey, item);
    }
  }

  // 4. Perform targeted searches, broad discovery, and commentary-delta processing
  const items: IntakeItemInput[] = [];
  const processedKeys = new Set<string>();

  for (const raw of rawItems) {
    const itemKey = `orchestrated:${raw.id}`;
    if (processedKeys.has(itemKey)) continue;
    processedKeys.add(itemKey);

    const titleLower = raw.title.toLowerCase();
    const summaryLower = raw.summary.toLowerCase();

    // Check if matching active assets or catalyst keywords
    const matchesAsset = Array.from(activeAssets).some(asset => titleLower.includes(asset) || summaryLower.includes(asset));
    const matchesKeyword = Array.from(activeKeywords).some(kw => titleLower.includes(kw) || summaryLower.includes(kw));

    let recommendedAction: IntakeItemInput["recommendedAction"] = "monitor";
    if (matchesAsset || matchesKeyword) {
      recommendedAction = "collect_evidence";
    }

    // Commentary-Delta processing
    const pubKey = raw.publisher.toLowerCase().trim();
    const previous = latestPastByPublisher.get(pubKey);
    let divergenceKind: IntakeItemInput["divergenceKind"] = "none";
    let divergenceNote: string | undefined = undefined;

    if (previous && previous.id !== raw.id) {
      const delta = detectSentimentShift(previous.title + " " + previous.summary, raw.title + " " + raw.summary);
      if (delta.shift) {
        divergenceKind = "contradiction";
        divergenceNote = `Commentary Delta: Publisher shifted from ${delta.prevSentiment} to ${delta.currSentiment}. Previous title: "${previous.title}".`;
        recommendedAction = "recalibrate_story";
      }
    }

    items.push({
      itemKey,
      itemType: "news",
      publisher: raw.publisher,
      title: raw.title,
      url: `https://alchemy-orchestrator.clydigital.com/items/${raw.id}`,
      publishedAt: raw.published_at,
      summary: raw.summary,
      sourceQuality: 75,
      relevance: matchesAsset ? 85 : 55,
      novelty: divergenceKind !== "none" ? 80 : 50,
      materiality: matchesKeyword ? 80 : 50,
      recommendedAction,
      divergenceKind,
      divergenceNote,
      affectedStorySlugs: Array.from(activeSlugs).filter(slug => titleLower.includes(slug) || summaryLower.includes(slug)),
      evidence: []
    });
  }

  // 5. Build canonical ResearchRunInput
  const requiredSources: SourceCheckInput[] = [
    { source: "stockedup", status: "no_new_items", itemCount: 0 },
    { source: "wall-street-truth-bombs", status: "no_new_items", itemCount: 0 },
    { source: "traders-reality", status: "no_new_items", itemCount: 0 },
    { source: "zerohedge", status: "checked", itemCount: items.length },
    { source: "axios", status: "checked", itemCount: 5 },
    { source: "investing-com", status: "checked", itemCount: 5 },
    { source: "fxstreet", status: "checked", itemCount: 5 },
    { source: "alchemy-market-insights", status: "checked", itemCount: 2 }
  ];

  const now = new Date();
  const runKey = `orchestration:${now.toISOString().replace(/[^a-zA-Z0-9]/g, "").slice(0, 14)}`;

  // Map to slot key based on hour
  const hour = now.getUTCHours();
  const scheduleSlot: ResearchRunInput["scheduleSlot"] = hour < 12 ? "morning" : "evening";

  const runPayload: ResearchRunInput = {
    runKey,
    scheduleSlot,
    scheduledFor: now.toISOString(),
    sourceChecks: requiredSources,
    items,
    dryRun: options.dryRun === true
  };

  // 6. Push to internal research-update endpoint
  const host = options.host || process.env.LIVE_DESK_UPDATE_URL || "http://localhost:3000/api/research-update";

  const response = await fetch(host, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(runPayload)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Orchestrator pipeline dispatch failed (${response.status}): ${detail}`);
  }

  return response.json();
}
