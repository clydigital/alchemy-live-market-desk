import 'server-only';
import { createSupabaseAdminClient } from './supabase/admin.ts';
import { HORMUZ_ENDPOINTS, parseHormuz, type HormuzMonitor, type HormuzSnapshot } from './hormuz-monitor-core.ts';

export async function getHormuzMonitor(): Promise<HormuzMonitor> {
  const checkedAt = new Date().toISOString();
  let snapshot: HormuzSnapshot | null = null;
  let nextAttemptAt: string | null = null;
  try {
    const db = createSupabaseAdminClient();
    const read = async () => {
      const { data, error } = await db.from('hormuz_monitor_cache').select('snapshot,next_attempt_at,refresh_failed').eq('id', 'crossings-v1').single();
      if (error) throw error;
      snapshot = data.snapshot as HormuzSnapshot | null;
      nextAttemptAt = Number.isFinite(Date.parse(data.next_attempt_at)) ? data.next_attempt_at : null;
      return { snapshot, checkedAt, nextAttemptAt, refreshFailed: data.refresh_failed } as HormuzMonitor;
    };
    const cached = await read();
    if (nextAttemptAt && Date.parse(nextAttemptAt) > Date.now()) return cached;
    const { data: claim, error: claimError } = await db.rpc('claim_hormuz_refresh');
    if (claimError) throw claimError;
    if (!claim) return read();
    let payload: HormuzSnapshot | null = null;
    let failed = false;
    try {
      const results = await Promise.all(HORMUZ_ENDPOINTS.map(async url => {
        const response = await fetch(url, { cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12_000) });
        if (!response.ok) throw new Error('Source unavailable');
        const body = await response.text();
        if (body.length > 200_000) throw new Error('Oversized source payload');
        return JSON.parse(body) as unknown;
      }));
      payload = parseHormuz(results[0], results[1], new Date().toISOString());
      if (cached.snapshot && Date.parse(payload.observedAt) < Date.parse(cached.snapshot.observedAt)) throw new Error('Source timestamp regressed');
    } catch { failed = true; }
    const { error: writeError } = await db.rpc('finish_hormuz_refresh', { claim, payload, failed });
    if (writeError) throw writeError;
    return read();
  } catch {
    // Never bypass the durable gate if storage/credentials are unavailable.
    return { snapshot, checkedAt, nextAttemptAt, refreshFailed: true, unavailableReason: 'Source cache unavailable' };
  }
}
