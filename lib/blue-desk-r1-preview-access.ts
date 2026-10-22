/**
 * Exact, read-only Markets presentation access for the R1 review deployment.
 *
 * Authorised only on the explicitly named V7 preview Git branch, only on the
 * deployment's own hostname, and only for a GET/HEAD of the presentation page.
 * Vercel deployment protection still mediates access through a temporary share
 * token. No API, machine route, Newsroom, Dossier or production bypass.
 *
 * DO NOT broaden this to arbitrary Vercel previews or production domains.
 */
export const R1_MARKETS_PREVIEW_BRANCH = "preview/v7-integrated-r1-20261021";

type PreviewRequest = {
  environment: string | undefined;
  branch: string | undefined;
  deploymentHostname: string | undefined;
  requestedHostname: string | undefined;
  pathname: string;
  method: string;
};

export function allowR1MarketsReadOnlyPreview(input: PreviewRequest): boolean {
  const deploy = (input.deploymentHostname ?? "").trim().toLowerCase();
  const requested = (input.requestedHostname ?? "").trim().toLowerCase();
  return input.environment === "preview"
    && input.branch === R1_MARKETS_PREVIEW_BRANCH
    && deploy.length > 0
    && deploy.endsWith(".vercel.app")
    && requested === deploy
    && input.pathname === "/blue-desk/markets"
    && (input.method === "GET" || input.method === "HEAD");
}

/**
 * The real (not public Blue Desk proxy) Live Desk overview is permitted on
 * this one Vercel-authenticated V7 review deployment, behind an expiring
 * review link. Any mutations still hit independently protected endpoints.
 * Other owner routes, APIs, production and unrelated preview builds remain
 * behind application authentication.
 */
export function allowR1LiveDeskReadOnlyPreview(input: PreviewRequest): boolean {
  return input.pathname === "/owner/live"
    && allowR1MarketsReadOnlyPreview({
      ...input,
      pathname: "/blue-desk/markets",
    });
}
