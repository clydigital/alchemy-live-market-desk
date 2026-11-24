"use client";
import {useEffect,useRef,useState} from "react";
import ui from "./MarketsScannerWidgets.module.css";

const TOOLS = [
 {id:"stocks",label:"Stock heatmap",description:"Spot sector leadership, concentration and unusual laggards.",url:"https://www.tradingview.com/heatmap/stock/",script:"embed-widget-stock-heatmap.js",config:{dataSource:"SPX500",blockSize:"market_cap_basic",blockColor:"change",grouping:"sector",locale:"en",colorTheme:"dark",exchanges:[],hasTopBar:true,isDataSetEnabled:true,isZoomEnabled:true,hasSymbolTooltip:true,isMonoSize:false,width:"100%",height:"100%"}},
 {id:"fx",label:"Currency strength",description:"Compare daily percentage moves across major currencies. Read each row against its quote currencies.",url:"https://www.tradingview.com/markets/currencies/forex-heat-map/",script:"",config:{}},
 {id:"screener",label:"Stock screener",description:"Explore equity filters and shortlist companies for further research.",url:"https://www.tradingview.com/screener/",script:"embed-widget-screener.js",config:{market:"america",showToolbar:true,defaultColumn:"overview",defaultScreen:"general",isTransparent:false,locale:"en",colorTheme:"dark",width:"100%",height:"100%"}}
] as const;
type Tool=typeof TOOLS[number];

function Embed({tool}:{tool:Tool}){
 const host=useRef<HTMLDivElement>(null);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  const mount=host.current;if(!mount)return;
  let active=true;
  const fail=()=>{if(active)setFailed(true);};
  const root=document.createElement("div");root.style.height="100%";root.style.width="100%";
  mount.appendChild(root);
  let script:HTMLScriptElement;
  if(tool.id==="fx"){
   const element=document.createElement("tv-forex-table");
   element.setAttribute("displayed-value","dailyChange");element.setAttribute("heatmap","");
   element.style.display="block";element.style.width="100%";element.style.height="100%";
   root.appendChild(element);
   script=document.createElement("script");script.type="module";
   script.src="https://widgets.tradingview-widget.com/w/en/tv-forex-table.js";
  }else{
   root.className="tradingview-widget-container";
   const slot=document.createElement("div");slot.className="tradingview-widget-container__widget";
   slot.style.width="100%";slot.style.height="calc(100% - 32px)";root.appendChild(slot);
   const credit=document.createElement("div");credit.className="tradingview-widget-copyright";
   const a=document.createElement("a");a.href=tool.url;a.target="_blank";a.rel="noopener noreferrer nofollow";
   a.textContent=tool.label+" by TradingView";credit.appendChild(a);root.appendChild(credit);
   script=document.createElement("script");script.type="text/javascript";script.async=true;
   script.src="https://s3.tradingview.com/external-embedding/"+tool.script;
   script.textContent=JSON.stringify(tool.config);
  }
  script.addEventListener("error",fail);
  root.appendChild(script);
  return ()=>{active=false;script.removeEventListener("error",fail);root.remove();};
 },[tool]);
 return <>{failed?<p role="status">The widget could not load. Use the TradingView link above to continue.</p>:null}<div ref={host} className={ui.embed} aria-label={tool.label+" interactive TradingView widget"}/></>;
}

export default function MarketsScannerWidgets(){
 const [selected,setSelected]=useState<Tool["id"]>("stocks");
 const tool=TOOLS.find(t=>t.id===selected)!;
 return <section className={ui.scanner} aria-label="Market discovery tools">
  <nav className={ui.tabs} aria-label="Choose scanner tool">
   {TOOLS.map(t=><button key={t.id} type="button" aria-pressed={selected===t.id} onClick={()=>setSelected(t.id)}>{t.label}</button>)}
  </nav>
  <div className={ui.heading}><div><h2>{tool.label}</h2><p>{tool.description}</p></div><a href={tool.url} target="_blank" rel="noopener noreferrer">Open on TradingView ↗</a></div>
  <Embed key={tool.id} tool={tool}/>
  <p className={ui.note}>Data and availability are supplied by TradingView; quotes may be delayed. These discovery widgets do not feed Bluebelly's verified market observations or automated trade signals.</p>
 </section>;
}
