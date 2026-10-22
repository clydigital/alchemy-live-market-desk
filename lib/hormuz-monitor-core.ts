export const HORMUZ_SOURCE = 'https://hormuz.data-tracking.net';
export const HORMUZ_ENDPOINTS = [`${HORMUZ_SOURCE}/api/summary?hours=24`, `${HORMUZ_SOURCE}/api/crossings/daily?days=30`] as const;
export const HORMUZ_STALE_MS = 90 * 60_000;
export type CrossingDay = { day: string; inbound: number | null; outbound: number | null; partial: boolean };
export type HormuzSnapshot = {
  observedAt: string; retrievedAt: string; periodHours: 24;
  inbound: number; outbound: number; total: number; daily: CrossingDay[];
};
export type HormuzMonitor = {
  snapshot: HormuzSnapshot | null; checkedAt: string; nextAttemptAt: string | null;
  refreshFailed: boolean; unavailableReason?: string;
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid source object');
  return value as Record<string, unknown>;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid crossing count');
  return value;
}
export function parseHormuz(summary: unknown, daily: unknown, retrievedAt: string): HormuzSnapshot {
  const s = record(summary);
  const time = typeof s.last_poll === 'string' ? Date.parse(s.last_poll) : NaN;
  if (!Number.isFinite(time) || !/(Z|[+-]\d{2}:\d{2})$/.test(String(s.last_poll)) || time > Date.parse(retrievedAt) + 300_000) throw new Error('Invalid source observation timestamp');
  if (s.period_hours !== 24 || !Array.isArray(daily) || daily.length > 1000) throw new Error('Invalid source window');
  const inbound = count(s.inbound), outbound = count(s.outbound), total = count(s.total_crossings);
  if (total !== inbound + outbound) throw new Error('Crossing totals disagree');
  const observedAt = new Date(time).toISOString();
  const sourceDay = observedAt.slice(0, 10);
  const days = new Map<string, CrossingDay>();
  const seen = new Set<string>();
  for (const raw of daily) {
    const row = record(raw);
    if (typeof row.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !Number.isFinite(Date.parse(row.day)) || new Date(row.day).toISOString().slice(0, 10) !== row.day || row.day > sourceDay) throw new Error('Invalid daily observation date');
    if (!['inbound', 'outbound', 'in_strait'].includes(String(row.direction))) throw new Error('Unknown crossing direction');
    const n = count(row.count);
    // Ships in the strait have not completed a crossing.
    if (row.direction === 'in_strait') continue;
    const key = `${row.day}:${row.direction}`;
    if (seen.has(key)) throw new Error('Duplicate daily crossing row');
    seen.add(key);
    const point = days.get(row.day) || { day: row.day, inbound: null, outbound: null, partial: row.day === sourceDay };
    point[row.direction as 'inbound' | 'outbound'] = n;
    days.set(row.day, point);
  }
  const sorted = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
  // The first day may be truncated by the rolling API window.
  if (sorted.length) sorted[0].partial = true;
  return { observedAt, retrievedAt, periodHours: 24, inbound, outbound, total, daily: sorted.slice(-30) };
}
export function hormuzFreshness(monitor: HormuzMonitor, now = Date.now()): 'unavailable' | 'stale' | 'current' {
  const s = monitor.snapshot;
  if (!s) return 'unavailable';
  const observation = Date.parse(s.observedAt), retrieval = Date.parse(s.retrievedAt);
  if (monitor.refreshFailed || !Number.isFinite(observation) || !Number.isFinite(retrieval) || now - observation >= HORMUZ_STALE_MS || now - retrieval >= HORMUZ_STALE_MS || observation > now + 300_000) return 'stale';
  return 'current';
}
export function crossingTrend(snapshot: HormuzSnapshot) {
  const sourceDay = Date.parse(snapshot.observedAt.slice(0, 10));
  const days = new Map(snapshot.daily.map(day => [day.day, day]));
  const totals: number[] = [];
  for (let offset = 1; offset <= 14; offset++) {
    const key = new Date(sourceDay - offset * 86_400_000).toISOString().slice(0, 10);
    const row = days.get(key);
    if (!row || row.partial || row.inbound === null || row.outbound === null) return null;
    totals.push(row.inbound + row.outbound);
  }
  const latest = totals.slice(0, 7).reduce((a, b) => a + b, 0);
  const previous = totals.slice(7).reduce((a, b) => a + b, 0);
  return { latest, previous, delta: latest - previous, percent: previous === 0 ? null : (latest - previous) / previous * 100 };
}
