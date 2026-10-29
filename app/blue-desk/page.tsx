import DecisionBrief from "@/components/blue-desk/DecisionBrief";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { selectPostEventRecaps } from "@/lib/bluebelly-post-event-recap";
import { getEventSocialContext } from "@/lib/bluebelly-event-social-server";
import styles from "./blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Blue Desk | Market Intelligence",
  description: "Market stories, rates and upcoming events.",
};

export default async function BlueDeskPage() {
  const now = new Date();
  const host = (await headers()).get("host");
  // This front page is an editorial gateway. Full market series, historical
  // research and company investigations stay available on their dedicated pages.
  const [macro, earnings, verifiedMotions, originalPress] = await Promise.all([
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getCurrentVerifiedMarketMotion({ limit: 24 }).catch(() => []),
    getOriginalPressNews(now,18,7).catch(() => []),
  ]);
  const recentNews = combineQualifiedNews(
    selectVerifiedNewsBriefs(verifiedMotions, now, 12), originalPress, 18,
  );
  const verifiedNews = recentNews.filter(
    n => Date.parse(n.occurredAt) <= +now && +now-Date.parse(n.occurredAt) <= 48*3600000,
  );
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const postEventRecaps = selectPostEventRecaps(recentNews, now, 8);
  const recapLead = postEventRecaps[0];
  const postEventSocial = recapLead?.kind === "bank"
    ? await getEventSocialContext(recapLead.id, recapLead.releaseAt, now).catch(() => [])
    : [];

  return (
    <main className={styles.page} data-blue-desk-convergence="decision-first-home">
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>
        <DecisionBrief news={verifiedNews} recentNews={recentNews} calendar={calendar} now={now} host={host}
          postEventRecaps={postEventRecaps} postEventSocial={postEventSocial} />
      </div>
    </main>
  );
}
