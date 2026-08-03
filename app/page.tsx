import AnalystNotes from '@/components/AnalystNotes';
import { getDeskData, type Story } from '@/lib/data';

export const dynamic = 'force-dynamic';

const events = [
  ['MON 03', 'ISM Manufacturing', 'Growth and prices paid'],
  ['TUE 04', 'AMD · after close', 'AI demand, margin and guide'],
  ['TUE 04', 'JOLTS', 'Labour demand and quits'],
  ['WED 05', 'ISM Services', 'Demand and service inflation'],
  ['THU 06', 'Productivity + ULC', 'Margin and wage pressure'],
  ['FRI 07', 'US payrolls', 'Rates, USD and risk'],
];

const fallbackCharts = [
  ['SPX vs RSP', 'Is earnings support broadening beyond megacaps?'],
  ['AMD · SOXX · Nasdaq', 'Is AMD entering results as a leader or crowded rebound?'],
  ['Hyperscaler capex vs FCF', 'Which AI spenders are converting investment into cash?'],
];

const clean = (value: string | null | undefined, fallback: string) => value?.trim() || fallback;
const score = (value: number | null | undefined, fallback = 60) => Math.max(0, Math.min(100, Math.round(value ?? fallback)));

function StoryBubble({ story, index }: { story: Story; index: number }) {
  return <a href={`#${story.slug}`} className={`bubble bubble-${index + 1}`}><small>{story.rank ? `0${story.rank}` : 'LIVE'}</small><b>{story.title}</b><span>{score(story.confidence)}%</span></a>;
}

function Spark({ index }: { index: number }) {
  const paths = ['M2 34 C18 31 27 38 40 25 S68 29 82 16 S108 18 126 7','M2 26 C20 13 34 20 48 29 S75 34 91 21 S111 13 126 18','M2 36 C20 37 30 22 44 25 S66 12 82 17 S104 30 126 9'];
  return <svg viewBox="0 0 128 44" aria-hidden="true"><path d={paths[index % 3]} /></svg>;
}

export default async function Page() {
  const data = await getDeskData();
  const stories = data.stories;
  const top = stories[0];
  const ai = stories.find((s) => /ai|capex|chip|semi/i.test(`${s.title} ${s.thesis}`)) || stories[1] || top;
  const charts = (data.charts.length ? data.charts.map((c) => [c.instrument, c.question]) : fallbackCharts).slice(0, 3);
  const calls = data.calls.slice(0, 4);

  return <main className="shell">
    <aside className="rail"><div className="logo">A</div><nav><a href="#top">Desk</a><a href="#field">Stories</a><a href="#week">Calendar</a><a href="#ai">AI</a><a href="#charts">Charts</a><a href="#ledger">Ledger</a></nav><span className="live">● LIVE</span></aside>
    <div className="content" id="top">
      <header className="topbar"><b>ALCHEMY <i>LIVE DESK</i></b><div className="search">⌘ K&nbsp;&nbsp; Search a story, company or question</div><span>LY</span></header>

      <section className="hero">
        <article className="hero-main">
          <div className="meta"><span>● CENTRAL QUESTION 01</span><em>Persistent research state</em></div>
          <h1>Can earnings keep the market alive?</h1>
          <p>Can earnings quality outrun higher yields, elevated valuations and weak breadth?</p>
          <div className="hero-read">
            <div className="gauge" style={{background:`conic-gradient(#6938f5 ${score(top?.confidence) * 3.6}deg,#e8e4f7 0)`}}><div><b>{score(top?.confidence)}%</b><span>near-term likelihood</span></div></div>
            <div><small>CURRENT READ</small><h2>{clean(top?.best_explanation, 'Strong results can support the index, but guidance, cash conversion and breadth now decide whether the move lasts.')}</h2><div className="signals"><span><b>Supportive</b>Earnings</span><span><b>Constraint</b>Rates</span><span><b>Incomplete</b>Breadth</span></div></div>
          </div>
          <div className="contradiction"><small>BIGGEST CONTRADICTION</small><p>{clean(top?.strongest_contradiction, 'Good earnings can lift the index while the average stock remains fragile.')}</p></div>
        </article>

        <aside className="calendar" id="week"><div className="section-title"><small>WEEK OF 03 AUG 2026</small><h2>Decision map</h2><p>Only events capable of changing an active thesis.</p></div>{events.map((e, i) => <div className={`event ${i === 1 ? 'key' : ''}`} key={`${e[0]}-${e[1]}`}><b>{e[0]}</b><span><strong>{e[1]}</strong><small>{e[2]}</small></span><em>{i === 1 ? 'KEY TEST' : 'WATCH'}</em></div>)}</aside>
      </section>

      <section className="field" id="field">
        <div className="field-head"><div><small>LIVE STORY FIELD</small><h2>What is moving the system</h2></div><p>Size reflects importance. Pulse reflects fresh evidence.</p></div>
        <div className="field-grid"><div className="orbits"><i className="orbit one"/><i className="orbit two"/>{stories.slice(0,5).map((story,index)=><StoryBubble key={story.id} story={story} index={index}/>)}</div><aside className="chart-rail"><small>CHART RAIL</small>{charts.map((c,index)=><article key={c[0]}><div><b>{c[0]}</b><span>QUESTION 0{index+1}</span></div><Spark index={index}/><p>{c[1]}</p></article>)}</aside></div>
      </section>

      <section className="ai" id="ai">
        <div className="field-head light"><div><small>CENTRAL QUESTION 02</small><h2>Is AI revenue catching up with AI capex?</h2></div><strong>{score(ai?.confidence,55)}%</strong></div>
        <div className="ai-grid"><article className="pipeline"><div className="steps">{['CAPEX','CAPACITY','USAGE','REVENUE','CASH'].map((step,i)=><div key={step}><i>0{i+1}</i><b>{step}</b><span>{['Data centres, power and chips','Compute reaches customers','Paid workloads expand','Cloud and software monetise','Returns survive depreciation'][i]}</span></div>)}</div><p><b>Leaks:</b> depreciation · component inflation · capacity delays · negative free cash flow</p></article><article className="amd"><div className="chip">AMD<small>04 AUG</small></div><div><small>THE WEEK'S AI PROOF POINT</small><h3>AMD must validate the hardware leg.</h3><p>Revenue, Data Center growth, gross margin, guidance, supply constraints and management confidence decide whether the semiconductor rebound has support.</p><div className="scenarios"><span>Acceleration</span><span>In-line</span><span>Disappointment</span></div></div></article></div>
      </section>

      <section className="lab"><div className="field-head light"><div><small>STORY LAB</small><h2>Thesis, contradiction and the next test</h2></div></div>{stories.slice(0,3).map((s)=><article className="story" id={s.slug} key={s.id}><header><div><small>{s.article_verdict || s.status}</small><h3>{s.title}</h3></div><b>{score(s.confidence)}%</b></header><p className="thesis">{s.thesis}</p><div className="logic"><div><small>MARKET QUESTION</small><p>{clean(s.market_question,'What would force the market to change its current view?')}</p></div><div><small>WHAT APPEARS PRICED</small><p>{clean(s.priced_assessment,'The first-order narrative is visible, but durability remains untested.')}</p></div><div className="support"><small>STRONGEST SUPPORT</small><p>{clean(s.strongest_support,'Primary evidence remains under review.')}</p></div><div className="against"><small>CONTRADICTION</small><p>{clean(s.strongest_contradiction,'Price and evidence are not fully aligned.')}</p></div></div><div className="triggers"><span><small>CONFIRM</small>{clean(s.confirmation_trigger,'Follow-through across price and evidence.')}</span><span><small>INVALIDATE</small>{clean(s.invalidation_trigger,'A material reversal in the transmission chain.')}</span><span><small>NEXT</small>{clean(s.next_catalyst,'Next official release or market confirmation.')}</span></div><footer><div>{s.assets?.slice(0,5).map(a=><i key={a}>{a}</i>)}</div><b>{clean(s.provisional_title,s.article_angle || 'Article angle under development')}</b></footer></article>)}</section>

      <section className="earnings"><div className="field-head light"><div><small>EARNINGS INTELLIGENCE</small><h2>Management language, not a beat-and-miss feed</h2></div></div><div className="call-grid">{calls.length ? calls.map(c=><article key={c.id}><header><b>{c.ticker}</b><small>{c.transcript_status}</small></header><h3>{c.company_name}</h3><p>{clean(c.summary,c.relevance_reason || 'Tracked because this call can change an active thesis.')}</p><dl><dt>GUIDANCE</dt><dd>{clean(c.guidance,'Monitoring')}</dd><dt>CAPEX</dt><dd>{clean(c.capex,'Monitoring')}</dd><dt>DEMAND</dt><dd>{clean(c.demand,'Monitoring')}</dd></dl></article>) : <div className="empty">No relevant calls ingested yet.</div>}</div></section>

      <section className="workspace" id="charts"><article><div className="field-head light"><div><small>CHART WORKSPACE</small><h2>{charts[0]?.[0] || 'Primary chart'}</h2></div><em>Illustrative until chart upload</em></div><div className="big-chart"><svg viewBox="0 0 900 330" preserveAspectRatio="none"><path className="grid" d="M0 70H900 M0 140H900 M0 210H900 M0 280H900"/><path className="area" d="M0 275 C90 255 130 275 190 225 S300 165 360 195 S465 110 535 145 S650 76 720 112 S825 92 900 45 L900 330 L0 330Z"/><path className="line" d="M0 275 C90 255 130 275 190 225 S300 165 360 195 S465 110 535 145 S650 76 720 112 S825 92 900 45"/></svg><div><small>QUESTION</small><b>{charts[0]?.[1] || 'Does the tape confirm the central thesis?'}</b></div></div></article><aside><small>REQUESTED</small>{charts.map((c,i)=><div key={c[0]}><i>0{i+1}</i><span><b>{c[0]}</b><p>{c[1]}</p></span></div>)}</aside></section>

      <section className="ledger" id="ledger"><div className="field-head light"><div><small>RESEARCH LEDGER</small><h2>Only material changes enter the record</h2></div></div><div className="ledger-grid"><div className="updates">{data.updates.length ? data.updates.slice(0,7).map((u,i)=><article key={u.id}><i>0{i+1}</i><div><small>{u.update_type}</small><b>{u.headline}</b><p>{u.detail || 'Material update recorded.'}</p></div></article>) : <div className="empty">The ledger stays quiet until the evidence changes.</div>}</div><AnalystNotes/></div></section>
      <footer className="footer"><span>Alchemy Markets · Live research workspace</span><span>Educational use only</span></footer>
    </div>
  </main>;
}
