import { redirect } from "next/navigation";

/**
 * Duplicate public Daily Report is retired in favour of the Newsroom.
 * Public Bluebelly/Live links are redirected to Newsroom by middleware.
 * Owner-host bookmarks are preserved as a route into the complete private
 * Daily Intelligence under My Desk. This page cannot expose report contents.
 */
export const metadata = { robots: { index: false, follow: false } };

export default function RetiredDailyReport() {
  redirect("/my-reports");
}
