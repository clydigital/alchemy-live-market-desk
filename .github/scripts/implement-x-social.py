from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"{path}: expected {count} occurrence(s), found {actual}: {old[:100]!r}")
    p.write_text(text.replace(old, new, count))


# Make X a visible required source check but keep it outside the canonical direct-feed gate.
replace(
    "lib/research-update.ts",
    '  "fxstreet",\n  "alchemy-market-insights",',
    '  "fxstreet",\n  "x-social",\n  "alchemy-market-insights",',
)
replace(
    "lib/research-update.ts",
    'export type IntakeItemType = "video" | "news" | "alchemy_article";',
    'export type IntakeItemType = "video" | "news" | "social_post" | "alchemy_article";',
)
replace(
    "lib/research-update.ts",
    'if (!["video", "news", "alchemy_article"].includes(item.itemType))',
    'if (!["video", "news", "social_post", "alchemy_article"].includes(item.itemType))',
)

# Wire X into the existing scheduled acquisition path. No new scheduler or parallel pipeline.
replace(
    "lib/scheduled-research-input.ts",
    'import { scheduledVideoRunIdentity, scheduledVideoSlotForDesk } from "@/lib/scheduled-video-identity";\n',
    'import { scheduledVideoRunIdentity, scheduledVideoSlotForDesk } from "@/lib/scheduled-video-identity";\nimport { acquireXSocialPosts } from "@/lib/x-social-acquisition";\n',
)
replace(
    "lib/scheduled-research-input.ts",
    'const [videoChecks, zerohedge, axios, investing, fxstreet, alchemy, powerStack] = await Promise.all([',
    'const [videoChecks, zerohedge, axios, investing, fxstreet, xSocial, alchemy, powerStack] = await Promise.all([',
)
replace(
    "lib/scheduled-research-input.ts",
    '    acquireDirectFeed(DIRECT_FEEDS[3], windowStart, windowEnd),\n    acquireAlchemy(windowStart, windowEnd),',
    '    acquireDirectFeed(DIRECT_FEEDS[3], windowStart, windowEnd),\n    acquireXSocialPosts({ now }),\n    acquireAlchemy(windowStart, windowEnd),',
)
replace(
    "lib/scheduled-research-input.ts",
    '    fxstreet.check,\n    alchemy.check,',
    '    fxstreet.check,\n    xSocial.check,\n    alchemy.check,',
)
replace(
    "lib/scheduled-research-input.ts",
    '    ...fxstreet.items,\n    ...alchemy.items,',
    '    ...fxstreet.items,\n    ...xSocial.items,\n    ...alchemy.items,',
)

# Every monitored X source is discovery-only until an explicit future verification path says otherwise.
replace(
    "lib/intelligence/source-verification.ts",
    '] as const;\n\nexport function sourceVerificationRole',
    '] as const;\n\nconst SOCIAL_DISCOVERY_PATTERNS = [\n  /(?:^|[\\s/])(?:x\\.com|twitter\\.com|syndication\\.twitter\\.com)(?:[\\s/]|$)/i,\n  /\\bx[_-]?syndication[_-]?embed\\b/i,\n  /\\bx-social\\b/i,\n] as const;\n\nexport function sourceVerificationRole',
)
replace(
    "lib/intelligence/source-verification.ts",
    '  return ZEROHEDGE_READS_PATTERNS.some((pattern) => pattern.test(value)) ? "discovery_only" : "canonical";',
    '  return [...ZEROHEDGE_READS_PATTERNS, ...SOCIAL_DISCOVERY_PATTERNS].some((pattern) => pattern.test(value)) ? "discovery_only" : "canonical";',
)

# Preserve social as a first-class intake shape while ranking it Tier 4 and labelling its evidence nature.
replace(
    "lib/intelligence/runtime.ts",
    '  item_type: "video" | "news" | "alchemy_article";',
    '  item_type: "video" | "news" | "social_post" | "alchemy_article";',
)
replace(
    "lib/intelligence/runtime.ts",
    '  if (publisher.includes("tradingview") || publisher.includes("cme") || publisher.includes("ice") || publisher.includes("exchange")) return 2;\n  if (item.item_type === "video") return 5;',
    '  if (publisher.includes("tradingview") || publisher.includes("cme") || publisher.includes("ice") || publisher.includes("exchange")) return 2;\n  if (item.item_type === "social_post") return 4;\n  if (item.item_type === "video") return 5;',
)
replace(
    "lib/intelligence/runtime.ts",
    'item.item_type === "video" ? "creator_lead" : item.item_type === "alchemy_article" ? "research_context" : "fresh_news"',
    'item.item_type === "video" ? "creator_lead" : item.item_type === "social_post" ? "social_statement" : item.item_type === "alchemy_article" ? "research_context" : "fresh_news"',
)

replace(
    "lib/data.ts",
    '  item_type: "video" | "news" | "alchemy_article";',
    '  item_type: "video" | "news" | "social_post" | "alchemy_article";',
)

# Keep the rollout documentation truthful: collection is live-owned; presentation embedding is a separate concern.
p = Path("docs/RESEARCH_ROLLOUT.md")
text = p.read_text()
old = "Add company IR feeds, OPEC extraction, Treasury and Census data, Reuters or another licensed news feed, and approved X embedding. Social posts may establish that a statement was made, not that it is true."
new = "Add company IR feeds, OPEC extraction, Treasury and Census data, Reuters or another licensed news feed, and approved X presentation embedding. Live-owned monitored X discovery intake is active upstream; social posts establish that a statement was made, not that the underlying claim is true."
if old in text:
    p.write_text(text.replace(old, new, 1))

# The repo targets pre-ES2020 JavaScript, so avoid BigInt literals in the snowflake fallback.
replace(
    "lib/x-social-acquisition.ts",
    'const TWITTER_EPOCH_MS = 1_288_834_974_657n;',
    'const TWITTER_EPOCH_MS = 1_288_834_974_657;\nconst TWITTER_SNOWFLAKE_SEQUENCE = 4_194_304;',
)
replace(
    "lib/x-social-acquisition.ts",
    '  try {\n    const value = BigInt(postId);\n    const timestamp = Number((value >> 22n) + TWITTER_EPOCH_MS);\n    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;\n  } catch {\n    return null;\n  }',
    '  const value = Number(postId);\n  if (!Number.isFinite(value)) return null;\n  const timestamp = Math.floor(value / TWITTER_SNOWFLAKE_SEQUENCE) + TWITTER_EPOCH_MS;\n  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;',
)
