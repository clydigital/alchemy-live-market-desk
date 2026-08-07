import { STORY_FALLBACK_IMAGES } from "@/lib/story-fallback-images";

type RouteContext = {
  params: Promise<{ key: string }>;
};

function decodeDataUri(dataUri: string) {
  const match = dataUri.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) return null;

  return {
    contentType: match[1],
    bytes: new Uint8Array(Buffer.from(match[2], "base64")),
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  const image = STORY_FALLBACK_IMAGES.find((candidate) => candidate.key === key);
  if (!image) return new Response("Story fallback not found", { status: 404 });

  const decoded = decodeDataUri(image.dataUri);
  if (!decoded) return new Response("Story fallback is invalid", { status: 500 });

  return new Response(decoded.bytes, {
    status: 200,
    headers: {
      "Content-Type": decoded.contentType,
      "Content-Length": String(decoded.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${image.key}.webp"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
