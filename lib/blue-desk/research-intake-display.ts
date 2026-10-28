import type { NotionResearchBundle } from "../notion-market-research";

type State = Pick<NotionResearchBundle, "status" | "sources"> & {warnings?: string[]};

/**
 * Describes the reachability of Bluebelly's server-side Notion reader, NOT
 * the presence or absence of research in the Notion workspace itself.
 */
export function researchIntakeDisplay(input: State) {
  const sourcePermissionWarning = input.status === "UNAVAILABLE" &&
    (input.warnings ?? []).some(w => /(?:MacroPulse root page could not be listed|Research Gap data source could not be queried).*HTTP 404/i.test(w));
  if(sourcePermissionWarning) return {
    connected: false,
    sourcePermissionWarning: true,
    label: "Notion source access blocked",
    detail: "Notion returned HTTP 404 for a configured research source. The page may be unshared with the Vercel integration or its ID may have changed; this does not mean today's research is missing.",
  };
  switch (input.status) {
    case "NOT_CONFIGURED":
      return {
        sourcePermissionWarning: false,
        connected: false,
        label: "Server-side Notion reader not configured",
        detail: "Research may exist in Notion, but this deployment has no configured read-only integration.",
      };
    case "UNAVAILABLE":
      return {
        sourcePermissionWarning: false,
        connected: false,
        label: "Server-side Notion retrieval unavailable",
        detail: "This attempt could not retrieve the research. The Notion archive may still be current.",
      };
    case "PARTIAL":
      return {
        sourcePermissionWarning: false,
        connected: true,
        label: "Partial recent source coverage",
        detail: "Only the retrieved source-page previews are indexed here; additional Notion records may exist.",
      };
    case "READY_FOR_REVIEW":
      return {
        sourcePermissionWarning: false,
        connected: true,
        label: "Recent source previews available",
        detail: "These are research inputs, not independently admitted canonical market evidence.",
      };
  }
}
