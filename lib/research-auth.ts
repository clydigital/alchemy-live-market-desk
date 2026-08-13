import { timingSafeEqual } from "node:crypto";

export function acceptsResearchAuthorization(
  authorization: string | null,
  acceptedTokens: Array<string | undefined | null>,
) {
  const supplied = authorization?.replace(/^Bearer\s+/i, "") || "";
  if (!supplied) return false;

  return acceptedTokens.some((expected) => {
    if (!expected || supplied.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  });
}
