import type {HormuzWatchTile} from "@/lib/bluebelly-hormuz-public";
import {buildEnergyAccelerators} from "@/lib/bluebelly-energy-accelerators";
import AcceleratorDial from "./AcceleratorDial";
import s from "./EnergyAcceleratorDashboard.module.css";

export default function EnergyAcceleratorDashboard({tiles}:{tiles:readonly HormuzWatchTile[]}){
 const groups=buildEnergyAccelerators(tiles);
 return <section className={s.wrap} id="energy-accelerators" aria-label="Crude diesel and gasoline supply and demand accelerator dashboard"
   data-energy-accelerators="source-dated-direction-only">
  <header className={s.heading}>
   <div><span className={s.eyebrow}>PHYSICAL ENERGY / ACCELERATOR DASH</span>
    <h2>Crude, diesel &amp; gasoline</h2>
    <p>Separate inventory supply cushions, demand proxies and refining-price pressure. These instruments can disagree.</p></div>
   <p className={s.rule}>NEEDLE = CHANGE FROM PREVIOUS SOURCE PERIOD<br/>NOT SCARCITY LEVEL · NOT PEACE ODDS</p>
  </header>
  <div className={s.groups}>
   {groups.map(group=><article key={group.id} className={s.group} data-fuel-card={group.id}>
    <div className={s.groupHead}><span>{group.scope}</span><h3>{group.title}</h3><p>{group.subtitle}</p></div>
    <div className={s.dials}>
     {group.readings.map(dial=><div className={s.reading} key={dial.id}
       data-fuel-reading={dial.id} data-reading-freshness={dial.state}>
      <h4>{dial.label}</h4>
      <AcceleratorDial label={dial.label} direction={dial.direction}
       leftLabel={dial.leftLabel} rightLabel={dial.rightLabel}/>
      <strong className={s.value}>{dial.state==="available"?dial.current||"—":"—"}</strong>
      <span className={s.change}>{dial.state==="available"?(dial.change?"Δ "+dial.change:"No comparable prior reading"):
       dial.state==="stale"?"STALE SOURCE":"SOURCE UNAVAILABLE"}</span>
      <span className={s.date}>Source period: {dial.observedAt||"unknown"}</span>
      <p>{dial.interpretation}</p>
      {dial.sourceUrl?<a href={dial.sourceUrl} target="_blank" rel="noopener noreferrer"
       aria-label={`Source for ${group.title}: ${dial.label}`}>{dial.sourceName} ↗</a>:null}
     </div>)}
    </div>
    <p className={s.test}><strong>Next decisive test:</strong> {group.nextTest}</p>
   </article>)}
  </div>
  <p className={s.foot}>US weekly stock and product-supplied gauges are not a global supply-demand balance. Product supplied approximates consumption but is volatile. Refining cracks and Brent are price indicators, not physical supply measures. A week-on-week increase in inventories does not alone prove better supply: demand may have fallen. The needle parks when source data are stale, missing or lack a comparable prior period.</p>
 </section>;
}
