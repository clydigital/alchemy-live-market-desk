import type { NotionResearchBundle } from "../notion-market-research";

type State = Pick<NotionResearchBundle, "status" | "sources">;

/**
 * Describes the reachability of Bluebelly's server-side Notion reader, NOT
 * the presence or absence of research in the Notion workspace itself.
 */
export function researchIntakeDisplay(input: State) {
  switch (input.status) {
    case "NOT_CONFIGURED":
      return {
        connected: false,
        label: "Server-side Notion reader not configured",
        detail: "Research may exist in Notion, but this deployment has no configured read-only integration.",
      };
    case "UNAVAILABLE":
      return {
        connected: false,
        label: "Server-side Notion retrieval unavailable",
        detail: "This attempt could not retrieve the research. The Notion archive may still be current.",
      };
    case "PARTIAL":
      return {
        connected: true,
        label: "Partial recent source coverage",
        detail: "Only the retrieved source-page previews are indexed here; additional Notion records may exist.",
      };
    case "READY_FOR_REVIEW":
      return {
        connected: true,
        label: "Recent source previews available",
        detail: "These are research inputs, not independently admitted canonical market evidence.",
      };
  }
}
