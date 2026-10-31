import { redirect } from "next/navigation";

import { legacyTabRedirect } from "@/lib/live-desk/routes";

// Retired private Live Desk composite: existing bookmarked tabs retain their
// named destinations without invoking the former all-feeds dashboard.
type LegacyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyPage({ searchParams }: LegacyPageProps) {
  const query = await searchParams;
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  let target: string | null = null;
  try {
    target = legacyTabRedirect(tab);
  } catch {
    // A malformed legacy query must never crash the presentation route.
  }
  redirect(target ?? "/blue-desk");
}
