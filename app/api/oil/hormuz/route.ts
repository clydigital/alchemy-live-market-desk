import { NextResponse } from 'next/server';
import { getHormuzMonitor } from '@/lib/hormuz-monitor';
import { HORMUZ_ENDPOINTS, hormuzFreshness, crossingTrend } from '@/lib/hormuz-monitor-core';
import { acceptsResearchAuthorization } from '@/lib/research-auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  if (!acceptsResearchAuthorization(request.headers.get('authorization'), [process.env.RESEARCH_UPDATE_TOKEN, process.env.CRON_SECRET])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const monitor = await getHormuzMonitor();
  return NextResponse.json({ ...monitor, status: hormuzFreshness(monitor), trend: monitor.snapshot ? crossingTrend(monitor.snapshot) : null,
    sources: HORMUZ_ENDPOINTS, discoveryOnly: true, canonicalMutation: false,
  }, { status: monitor.snapshot ? 200 : 503, headers: { 'Cache-Control': 'private, no-store' } });
}
