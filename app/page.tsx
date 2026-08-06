import MarketWorkspace from '@/components/MarketWorkspace';
import { runAccuracyCheck } from '@/lib/accuracy';
import { getAlchemyArticles } from '@/lib/alchemy';
import { getEconomicCalendar } from '@/lib/calendar';
import { getDeskData } from '@/lib/data';
import { getMarketData } from '@/lib/market';
import { dashboardAuthRequired } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [data, articles, market, calendarEvents] = await Promise.all([
    getDeskData(),
    getAlchemyArticles(),
    getMarketData(),
    getEconomicCalendar(),
  ]);
  const accuracy = runAccuracyCheck(market);
  const authRequired = dashboardAuthRequired();

  return (
    <>
      {authRequired && (
        <form
          action="/auth/signout"
          method="post"
          style={{
            position: 'fixed',
            top: 14,
            right: 16,
            zIndex: 1000,
          }}
        >
          <button
            type="submit"
            style={{
              border: '1px solid rgba(255,255,255,.16)',
              borderRadius: 10,
              background: 'rgba(10,12,24,.86)',
              color: '#e9e6f5',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 800,
              padding: '9px 12px',
            }}
          >
            Sign out
          </button>
        </form>
      )}
      <MarketWorkspace
        {...data}
        articles={articles}
        market={market}
        accuracy={accuracy}
        calendarEvents={calendarEvents}
      />
    </>
  );
}
