/**
 * The Google OAuth return target is caller-controlled. A leading slash alone
 * is not a sufficient same-origin check: WHATWG URL parsing treats "/\\host"
 * as an external authority for special schemes like HTTPS.
 *
 * Only emit a canonical same-origin path. Keep internal page query/fragment
 * intact, but never redirect a completed sign-in to another domain or back
 * into the auth callback/sign-out flow.
 */
const FALLBACK = "/owner/live";
const INTERNAL_ORIGIN = "https://live-desk-owner.invalid";

export function safeOwnerReturnPath(input: string | null | undefined): string {
  if (!input || input.length > 2_048 || !input.startsWith("/") || input.startsWith("//")) {
    return FALLBACK;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(input)) return FALLBACK;
  const path = input.split(/[?#]/, 1)[0];
  // Disallow path separators encoded across redirects; query data may contain
  // encoded URLs legitimately and is validated by the destination page.
  if (/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(path)) return FALLBACK;
  try {
    const target = new URL(input, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN || !target.pathname.startsWith("/")) return FALLBACK;
    if (/^\/(?:auth|login)(?:\/|$)/i.test(target.pathname)) return FALLBACK;
    return target.pathname + target.search + target.hash;
  } catch {
    return FALLBACK;
  }
}
