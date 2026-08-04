import MarketWorkspace from '@/components/MarketWorkspace';
import { runAccuracyCheck } from '@/lib/accuracy';
import { getAlchemyArticles } from '@/lib/alchemy';
import { getEconomicCalendar } from '@/lib/calendar';
import { getDeskData } from '@/lib/data';
import { getMarketData } from '@/lib/market';

export const revalidate = 60;

export default async function Page() {
  const [data, articles, market, calendarEvents] = await Promise.all([getDeskData(), getAlchemyArticles(), getMarketData(), getEconomicCalendar()]);
  const accuracy = runAccuracyCheck(market);
  return <MarketWorkspace {...data} articles={articles} market={market} accuracy={accuracy} calendarEvents={calendarEvents} />;
}
