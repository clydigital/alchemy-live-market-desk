import { getCanonicalPublicationResponse } from "@/lib/intelligence/publication-feed-route";

export const dynamic = "force-dynamic";

// Compatibility alias. It intentionally delegates to the same canonical,
// persisted feed as V2 so slow live providers cannot block Hybrid.
export const GET = getCanonicalPublicationResponse;
