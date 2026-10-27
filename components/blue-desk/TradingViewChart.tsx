"use client";

import { createElement, useEffect, useState } from "react";
import { TV_INSTRUMENTS, type TvInstrument } from "@/lib/bluebelly-editorial-visuals";
import styles from "./TradingViewChart.module.css";

const SCRIPT_URL = "https://widgets.tradingview-widget.com/w/en/tv-advanced-chart.js";
const SCRIPT_ID = "bluebelly-tradingview-advanced";
const allInstruments = Object.entries(TV_INSTRUMENTS) as [TvInstrument,(typeof TV_INSTRUMENTS)[TvInstrument]][];
let scriptPromise: Promise<void> | null = null;

/** Request the official embed only following reader action. Never proxy price data. */
function ensureTradingView(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (customElements.get("tv-advanced-chart")) { resolve(); return; }
    const script = existing || document.createElement("script");
    if (!existing) {
      script.id = SCRIPT_ID;
      script.type = "module";
      script.async = true;
      script.src = SCRIPT_URL;
      document.head.appendChild(script);
    }
    script.addEventListener("error", () => reject(new Error("TradingView widget script blocked")), {once:true});
    // A loaded script must register its custom element. Avoid claiming that the market feed is ready.
    customElements.whenDefined("tv-advanced-chart").then(resolve, reject);
  }).catch(error => { scriptPromise = null; throw error; });
  return scriptPromise;
}

export default function TradingViewChart({
  initial = "us10y", compact = false, showPicker = false,
}: { initial?: TvInstrument; compact?: boolean; showPicker?: boolean }) {
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<TvInstrument>(initial);
  const [state, setState] = useState<"idle"|"loading"|"ready"|"blocked">("idle");
  useEffect(() => {
    if (!opened) return;
    let alive=true;
    ensureTradingView().then(() => {if(alive) setState("ready");})
      .catch(() => {if(alive) setState("blocked");});
    return () => {alive=false;};
  }, [opened]);
  const instrument=TV_INSTRUMENTS[selected];
  const external="https://www.tradingview.com/chart/?symbol="+encodeURIComponent(instrument.symbol);
  return <section className={styles.panel} data-tradingview-instrument={instrument.symbol}>
    <div className={styles.heading}>
      <div><strong>TradingView · {instrument.label}</strong><small>Provider-hosted chart · exchange data may be delayed</small></div>
      <a href={external} target="_blank" rel="noopener noreferrer">Open in TradingView ↗</a>
    </div>
    {showPicker && <label className={styles.picker}>
      Instrument
      <select value={selected} onChange={e=>setSelected(e.target.value as TvInstrument)}>
        {allInstruments.map(([key,value])=><option key={key} value={key}>{value.label}</option>)}
      </select>
    </label>}
    {!opened ? <button className={styles.load} type="button" onClick={()=>{setOpened(true);setState("loading");}}>
      Load TradingView chart
    </button> : <div className={compact?styles.chartCompact:styles.chart}>
      {state==="loading" && <p role="status" className={styles.status}>Connecting to TradingView…</p>}
      {state==="blocked" ? <p role="status" className={styles.status}>The chart was blocked or unavailable. Use the direct TradingView link above.</p> : null}
      {state==="ready" ? createElement("tv-advanced-chart",{
        key:"bluebelly-"+selected, symbol: instrument.symbol, interval:"1D",
        theme:"dark", locale:"en", timezone:"Etc/UTC", 
        style:{display:"block",width:"100%",height:"100%"},
      }) : null}
    </div>}
    <p className={styles.note}>A current chart is not proof of a past event reaction. Your private TradingView indicators and drawings are not imported.</p>
  </section>;
}
