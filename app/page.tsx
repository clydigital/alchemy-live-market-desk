import MarketWorkspace from '@/components/MarketWorkspace';
import { getAlchemyArticles } from '@/lib/alchemy';
import { getDeskData } from '@/lib/data';
import { getMarketData } from '@/lib/market';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [data, articles, market] = await Promise.all([getDeskData(), getAlchemyArticles(), getMarketData()]);
  return <MarketWorkspace {...data} articles={articles} market={market} />;
}
