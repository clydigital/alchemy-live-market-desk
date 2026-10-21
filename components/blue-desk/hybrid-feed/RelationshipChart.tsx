// @ts-nocheck
// Hybrid source mirror for Blue Desk owner-only read-only parity.
"use client";
import { canonicalRelationshipVisual, NO_SERIES_PLAN_DIAGNOSTIC } from "@/lib/blue-desk-hybrid-feed/canonical-visuals";

const labels = { cpi_all: "Headline CPI y/y", cpi_core: "Core CPI y/y", ppi_final_demand: "PPI final demand y/y", qqq: "QQQ monthly return", spy: "SPY monthly return", gld: "GLD monthly return", uup: "UUP monthly return", tlt: "TLT monthly return", uso: "USO monthly return", usdjpy: "USD/JPY monthly return", us2y: "US 2Y monthly change", us10y: "US 10Y monthly change" };
const normalizedKey = (value) => String(value || "").toLowerCase();
function rowKey(row) { return normalizedKey(row.series_key || row.series_id); }
function refLabel(ref) { return ref?.label || labels[normalizedKey(ref?.seriesId)] || ref?.seriesId || "Series"; }
function monthly(ref, macro, market) {
  const key = normalizedKey(ref?.seriesId || ref);
  const m = macro.filter((x) => rowKey(x) === key).sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date));
  if (m.length) return m.map((x) => ({ month: x.observation_date.slice(0, 7), value: x.yoy_change ?? x.mom_change ?? Number(x.value) })).filter((x) => x.value !== null && Number.isFinite(Number(x.value)));
  const rows = market.filter((x) => rowKey(x) === key).sort((a, b) => new Date(a.observation_date) - new Date(b.observation_date));
  return rows.map((x, i) => { if (!i) return null; const prev = Number(rows[i - 1].close), now = Number(x.close); if (!Number.isFinite(prev) || !Number.isFinite(now) || prev === 0) return null; const value = /us2y|us10y|yield/.test(key) ? now - prev : ((now / prev) - 1) * 100; return { month: x.observation_date.slice(0, 7), value }; }).filter(Boolean);
}
function corr(a, b) { if (a.length < 4) return null; const ma = a.reduce((s, x) => s + x, 0) / a.length, mb = b.reduce((s, x) => s + x, 0) / b.length; let num = 0, da = 0, db = 0; a.forEach((x, i) => { const ax = x - ma, bx = b[i] - mb; num += ax * bx; da += ax * ax; db += bx * bx; }); return da && db ? num / Math.sqrt(da * db) : null; }
function z(values) { const mean = values.reduce((s, x) => s + x, 0) / values.length; const sd = Math.sqrt(values.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / Math.max(values.length - 1, 1)) || 1; return values.map((x) => (x - mean) / sd); }
function svgPath(vals, w, h) { const min = -2.5, max = 2.5; return vals.map((v, i) => `${i ? "L" : "M"}${(i / Math.max(vals.length - 1, 1) * w).toFixed(2)},${(h - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * h).toFixed(2)}`).join(" "); }
function hasSeries(ref, macro, market) { const key = normalizedKey(ref?.seriesId || ref); return macro.some((x) => rowKey(x) === key) || market.some((x) => rowKey(x) === key); }
function explicitRefs(seriesRefs, seriesKeys) {
  if (Array.isArray(seriesRefs) && seriesRefs.length) return seriesRefs;
  if (Array.isArray(seriesKeys) && seriesKeys.length) return seriesKeys.map((seriesId) => ({ seriesId, label: labels[normalizedKey(seriesId)] || seriesId }));
  return [];
}

export default function RelationshipChart({ story, macroObservations = [], marketObservations = [], seriesRefs, seriesKeys, expectedRelationship, title = "Price relationship lens", compact = false }) {
  const canonical = canonicalRelationshipVisual(story);
  const requested = explicitRefs(seriesRefs, seriesKeys).length ? explicitRefs(seriesRefs, seriesKeys) : (canonical?.series || []);
  const expected = expectedRelationship || canonical?.expectedRelationship || "none_asserted";
  const valid = requested.filter((ref) => hasSeries(ref, macroObservations, marketObservations));
  const w = compact ? 320 : 520, h = compact ? 96 : 132;

  if (!requested.length) return <div className="relationship-empty">{NO_SERIES_PLAN_DIAGNOSTIC}</div>;
  if (requested.length >= 2 && valid.length < 2) return <div className="relationship-empty">Canonical series are attached, but enough stored history is not loaded to calculate this relationship.</div>;
  if (requested.length === 1 && !valid.length) return <div className="relationship-empty">Stored history is not loaded for {refLabel(requested[0])}.</div>;

  if (requested.length === 1) {
    const ref = requested[0], rows = monthly(ref, macroObservations, marketObservations).slice(compact ? -16 : -24);
    if (rows.length < 4) return <div className="relationship-empty">Not enough history is loaded for {refLabel(ref)}.</div>;
    const values = z(rows.map((row) => Number(row.value)));
    return <section className={`relationship-chart single ${compact ? "compact" : ""}`}><header><div><span>PRICE CHECK</span><h3>{title}</h3></div><b className="series-count">1 SERIES</b></header><p>{refLabel(ref)}. This checks direction and persistence only; it does not create a second comparison.</p><svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label={refLabel(ref)}><line x1="0" y1={h / 2} x2={w} y2={h / 2} className="relationship-zero"/><path d={svgPath(values, w, h)} className="relationship-line primary"/></svg><footer><span><i className="primary"></i>{refLabel(ref)}</span><small>{rows.length} monthly observations</small></footer></section>;
  }

  const [r1, r2] = requested;
  const a = monthly(r1, macroObservations, marketObservations), b = monthly(r2, macroObservations, marketObservations), bm = new Map(b.map((x) => [x.month, x.value])), aligned = a.filter((x) => bm.has(x.month)).slice(compact ? -16 : -24), av = aligned.map((x) => Number(x.value)), bv = aligned.map((x) => Number(bm.get(x.month))), r = corr(av, bv);
  if (aligned.length < 4) return <div className="relationship-empty">Not enough overlapping history is loaded for the attached canonical series.</div>;
  const az = z(av), bz = z(bv);
  return <section className={`relationship-chart ${compact ? "compact" : ""}`}><header><div><span>PRICE + CORRELATION</span><h3>{title}</h3></div><b className={r !== null && r < 0 ? "inverse" : "positive"}>{r === null ? "—" : `r ${r.toFixed(2)}`}</b></header><p>{refLabel(r1)} versus {refLabel(r2)}. The canonical expected relationship is <strong>{expected}</strong>; observed correlation remains descriptive and does not prove causation.</p><svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label={`${refLabel(r1)} versus ${refLabel(r2)}`}><line x1="0" y1={h / 2} x2={w} y2={h / 2} className="relationship-zero"/><path d={svgPath(az, w, h)} className="relationship-line primary"/><path d={svgPath(bz, w, h)} className="relationship-line secondary"/></svg><footer><span><i className="primary"></i>{refLabel(r1)}</span><span><i className="secondary"></i>{refLabel(r2)}</span><small>{aligned.length} monthly observations</small></footer></section>;
}
