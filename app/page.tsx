import MarketWorkspace from '@/components/MarketWorkspace';
import { getAlchemyArticles } from '@/lib/alchemy';
import { getDeskData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [data, articles] = await Promise.all([getDeskData(), getAlchemyArticles()]);
  return <MarketWorkspace {...data} articles={articles} />;
}
