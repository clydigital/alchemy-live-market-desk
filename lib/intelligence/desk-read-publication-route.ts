import { buildDeskRead, type DeskReadStory } from "@/lib/desk-read";
import { getCanonicalPublicationPayload } from "@/lib/intelligence/publication-feed-route";

type CanonicalFeedShape = {
  generatedAt?: string | null;
  materialDeltas?: Array<Record<string, unknown>>;
  deskMemory?: Record<string, unknown> | null;
  edition?: {
    generatedAt?: string | null;
    mode?: string | null;
  } | null;
  canonical?: {
    storyStates?: DeskReadStory[];
    causalEdges?: Array<Record<string, unknown>>;
    assetImpacts?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

/**
 * Add the Desk Read as a deterministic projection of the already-canonical
 * publication payload. Hybrid receives the result; it never constructs a
 * competing market explanation locally. The canonical payload stays in memory
 * until this final response is serialized, avoiding a parse/serialize round trip.
 */
export async function getCanonicalPublicationResponseWithDeskRead(editionId: string | null = null) {
  const publication = await getCanonicalPublicationPayload(editionId);
  const body = publication.body as CanonicalFeedShape;
  const generatedAt = body.edition?.generatedAt || body.generatedAt || new Date().toISOString();
  const historical = body.edition?.mode === "immutable_replay";

  const deskRead = buildDeskRead({
    stories: body.canonical?.storyStates || [],
    materialDeltas: (body.materialDeltas || []) as Parameters<typeof buildDeskRead>[0]["materialDeltas"],
    causalEdges: (body.canonical?.causalEdges || []) as Parameters<typeof buildDeskRead>[0]["causalEdges"],
    assetImpacts: (body.canonical?.assetImpacts || []) as Parameters<typeof buildDeskRead>[0]["assetImpacts"],
    deskMemory: body.deskMemory as Parameters<typeof buildDeskRead>[0]["deskMemory"],
    generatedAt,
    historical,
  });

  const headers = new Headers(publication.headers);
  headers.delete("content-length");
  headers.set("X-Alchemy-Desk-Read", deskRead.status);

  return Response.json({
    ...body,
    deskRead,
    canonical: {
      ...(body.canonical || {}),
      deskRead,
    },
  }, {
    status: publication.status,
    headers,
  });
}
