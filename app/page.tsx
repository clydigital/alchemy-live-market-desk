import MarketWorkspace from '@/components/MarketWorkspace';
import { getDeskData } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await getDeskData();
  return <MarketWorkspace {...data} />;
}
