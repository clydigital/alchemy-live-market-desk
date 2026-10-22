import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHormuz, hormuzFreshness, crossingTrend } from '../lib/hormuz-monitor-core.ts';
const retrievedAt = '2026-10-22T12:00:00Z';
const summary = {last_poll: '2026-10-22T11:31:00+00:00', period_hours:24, inbound:4, outbound:6,total_crossings:10};
const daily = Array.from({length:16}, (_, i) => ['inbound','outbound','in_strait'].map(direction => ({day:`2026-10-${String(7+i).padStart(2,'0')}`,direction,count:direction==='in_strait'?999:10}))).flat();
test('preserves source time and retrieval time; excludes in-strait and partial days', () => {
  const snapshot = parseHormuz(summary,daily,retrievedAt);
  assert.equal(snapshot.observedAt,'2026-10-22T11:31:00.000Z');
  assert.equal(snapshot.retrievedAt,retrievedAt);
  assert.equal(snapshot.total,10);
  assert.equal(snapshot.daily[0].partial,true);
  assert.equal(snapshot.daily.at(-1)?.partial,true);
  assert.deepEqual(crossingTrend(snapshot),{latest:140,previous:140,delta:0,percent:0});
});
test('missing direction or day is unknown, never zero or a bridged weekly trend', () => {
  const snapshot = parseHormuz(summary,daily.filter(r=>!(r.day==='2026-10-20'&&r.direction==='inbound')),retrievedAt);
  assert.equal(snapshot.daily.find(r=>r.day==='2026-10-20')?.inbound,null);
  assert.equal(crossingTrend(snapshot),null);
  const gap = parseHormuz(summary,daily.filter(r=>r.day!=='2026-10-20'),retrievedAt);
  assert.equal(crossingTrend(gap),null);
});
test('zero baseline does not yield infinite percentage', () => {
  const snapshot = parseHormuz(summary,daily.map(r=>({...r,count:0})),retrievedAt);
  assert.equal(crossingTrend(snapshot)?.percent,null);
});
test('rejects invalid counts, duplicated rows, totals, dates and future observations', () => {
  for(const s of [{...summary,inbound:-1},{...summary,total_crossings:11},{...summary,last_poll:'2026-10-23T12:00:00Z'},{...summary,last_poll:'2026-10-22 11:31:00'},{...summary,period_hours:12}]) assert.throws(()=>parseHormuz(s,daily,retrievedAt));
  assert.throws(()=>parseHormuz(summary,[...daily,daily[0]],retrievedAt));
  assert.throws(()=>parseHormuz(summary,[{day:'2026-02-31',direction:'inbound',count:1}],retrievedAt));
});
test('freshness is computed from observation, not refetch time, including open tabs', () => {
  const monitor = {snapshot:parseHormuz(summary,daily,retrievedAt),checkedAt:retrievedAt,nextAttemptAt:null,refreshFailed:false};
  assert.equal(hormuzFreshness(monitor,Date.parse(retrievedAt)),'current');
  assert.equal(hormuzFreshness(monitor,Date.parse('2026-10-22T13:01:00Z')),'stale');
  assert.equal(hormuzFreshness({...monitor,refreshFailed:true},Date.parse(retrievedAt)),'stale');
  assert.equal(hormuzFreshness({...monitor,snapshot:null}),'unavailable');
  monitor.snapshot.retrievedAt = '2026-10-22T14:00:00Z';
  assert.equal(hormuzFreshness(monitor,Date.parse('2026-10-22T14:00:00Z')),'stale');
});
test('durable gate is atomic, fails closed, and has no public database permissions', () => {
  const sql=readFileSync(new URL('../supabase/migrations/20261023060000_hormuz_monitor_cache.sql',import.meta.url),'utf8');
  assert.match(sql,/next_attempt_at <= clock_timestamp\(\)/);
  assert.match(sql,/interval '30 minutes'/);
  assert.match(sql,/case when failed then snapshot else payload end/);
  assert.match(sql,/enable row level security/);
  assert.match(sql,/from public, anon, authenticated/);
  const source=readFileSync(new URL('../lib/hormuz-monitor.ts',import.meta.url),'utf8');
  assert.ok(source.indexOf("db.rpc('claim_hormuz_refresh')") < source.indexOf('await fetch('));
});
