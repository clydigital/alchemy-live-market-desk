import MarketWorkspace from '@/components/MarketWorkspace';
import { getAlchemyArticles } from '@/lib/alchemy';
import { getEconomicCalendar } from '@/lib/calendar';
import { getDeskData } from '@/lib/data';
import { getMarketData } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [data, articles, market, calendarEvents] = await Promise.all([getDeskData(), getAlchemyArticles(), getMarketData(), getEconomicCalendar()]);
  return <MarketWorkspace {...data} articles={articles} market={market} calendarEvents={calendarEvents} />;
}
