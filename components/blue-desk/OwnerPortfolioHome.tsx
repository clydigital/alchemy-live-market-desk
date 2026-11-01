import "server-only";
import Link from "next/link";
import {redirect} from "next/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {publicMarketObservations, type PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import ui from "./OwnerPortfolioHome.module.css";

type Position={ticker:string;name:string;quantity:number|null;currency:string;recordedPrice:number|null;quantityAsOf:string|null;priceAsOf:string|null};
type Candidate={ticker:string;name:string;rank:number|null;theme:string;entry:string;invalidation:string};
type PrivateSnapshot={snapshot_as_of:string;legacy_source_retired:boolean;snapshot:unknown};

const clean=(value:unknown,length=140)=>typeof value==="string"?value.trim().slice(0,length):"";
const num=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)?value:null;
const code=(value:unknown)=>{const t=clean(value,20).toUpperCase();return /^[A-Z0-9][A-Z0-9.\-]{0,17}$/.test(t)?t:"";};
function positions(snapshot:unknown):Position[]{
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return [];
 const data=(snapshot as Record<string,unknown>).holdings;
 if(!Array.isArray(data))return [];
 return data.slice(0,100).flatMap(raw=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return [];
  const x=raw as Record<string,unknown>, ticker=code(x.ticker);
  if(!ticker)return [];
  const pos=x.position&&typeof x.position==="object"&&!Array.isArray(x.position)?x.position as Record<string,unknown>:{};
  return [{ticker,name:clean(x.name)||ticker,quantity:num(pos.quantity),currency:clean(pos.currency,8),
   recordedPrice:num(pos.latestPrice),quantityAsOf:clean(pos.quantityAsOf,30)||null,
   priceAsOf:clean(pos.priceAsOf,30)||null}];
 });
}
function candidates(snapshot:unknown):Candidate[]{
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return [];
 const data=(snapshot as Record<string,unknown>).watchlist;
 if(!Array.isArray(data))return [];
 return data.slice(0,200).flatMap(raw=>{
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return [];
  const x=raw as Record<string,unknown>,ticker=code(x.ticker);
  return ticker?[{ticker,name:clean(x.name)||ticker,rank:num(x.rank),
   theme:clean(x.theme,180),entry:clean(x.entry,500),invalidation:clean(x.invalidation,500)}]:[];
 }).sort((a,b)=>(a.rank??999)-(b.rank??999));
}
type AdvisorView={headline:string;summary:string;asOf:string;capitalMYR:number|null;
  cashVerified:boolean;positionsVerified:boolean;
  moves:Array<{title:string;description:string;next:string;notYet:string}>};
function advisorFromArchive(snapshot:unknown):AdvisorView|null{
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return null;
 const raw=(snapshot as Record<string,unknown>).investmentAdvisor;
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const x=raw as Record<string,unknown>;
 const capital=x.capital&&typeof x.capital==="object"&&!Array.isArray(x.capital)
   ?x.capital as Record<string,unknown>:{};
 const moves=(Array.isArray(x.firstMoves)?x.firstMoves:[]).slice(0,3)
  .filter(v=>v&&typeof v==="object"&&!Array.isArray(v))
  .map(v=>{const m=v as Record<string,unknown>;return {
   title:clean(m.title,160),description:clean(m.description,360),
   next:clean(m.do,320),notYet:clean(m.notYet,320),
  };});
 return {headline:clean(x.heading,180),summary:clean(x.standfirst,550),
  asOf:clean(x.asOf,30),capitalMYR:num(capital.totalMYR),
  cashVerified:capital.cashVerified===true,
  positionsVerified:capital.positionsVerified===true,moves};
}
const showChange=(n:number|null,unit:"%"|"bp"|"pp"="%")=>n===null?"—":`${n>0?"+":""}${n.toFixed(2)}${unit}`;
function latest(row:PublicMarketObservation|undefined){
 if(!row)return null;
 return row.asOf&&row.last!==null?row:null;
}

/** My Desk is already middleware-protected; verify the owner again before the RLS read.
 * Never load portfolio holdings from public GitHub Pages or silently mark an archive as live.
 * Existing market-monitor observations can refresh on visits, but quantities never self-update. */
export default async function OwnerPortfolioHome(){
 const supabase=await createSupabaseServerClient().catch(()=>null);
 if(!supabase)return <section className={ui.status}><h2>Portfolio unavailable</h2><p>Google authentication is not configured.</p></section>;
 const {data:{user},error:authError}=await supabase.auth.getUser();
 if(authError||!user?.id||!user.email)redirect("/auth/google?next=%2Fmy-reports%3Fview%3Dportfolio");
 const {data:access,error:allowError}=await supabase.from("app_access_allowlist")
  .select("email").eq("email",user.email.trim().toLowerCase()).eq("active",true).maybeSingle();
 if(allowError||!access)redirect("/login?error=not_allowed&next=%2Fmy-reports%3Fview%3Dportfolio");
 const {data:record,error:readError}=await supabase.from("power_stack_owner_snapshots")
  .select("snapshot_as_of,legacy_source_retired,snapshot").eq("owner_user_id",user.id)
  .order("snapshot_as_of",{ascending:false}).limit(1).maybeSingle();
 const snapshot=!readError&&record?record as PrivateSnapshot:null;
 const ready=snapshot?.legacy_source_retired===true;
 const holdings=ready?positions(snapshot?.snapshot):[];
 const watchlist=ready?candidates(snapshot?.snapshot):[];
 const advice=ready?advisorFromArchive(snapshot?.snapshot):null;
 // This is only an observed public market quote overlay inside the private page,
 // not an ownership feed or a reconstructed balance. On invalid or missing sessions
 // we preserve null rather than invent current market values.
 const monitor=ready&&holdings.length?await getMarketMonitor().catch(()=>null):null;
 const tape=new Map<string,PublicMarketObservation>();
 for(const row of publicMarketObservations(monitor?.rows||[],"all")){
  if(!row.symbol||row.last===null||!row.asOf)continue;
  const old=tape.get(row.symbol.toUpperCase());
  if(!old||row.asOf>=(old.asOf||""))tape.set(row.symbol.toUpperCase(),row);
 }
 const observed=holdings.filter(h=>latest(tape.get(h.ticker))).length;
 return <section className={ui.root} data-my-desk-portfolio="google-allowlisted"
     data-private-data-ready={ready?"yes":"no"}>
   <div className={ui.intro}>
    <div><p className={ui.kicker}>02 / PORTFOLIO · PRIVATE</p>
     <h2>My Portfolio</h2>
     <p>Power Stack research, in your Bluebelly desk. Source-dated price movement is
        separate from recorded holdings, and no broker orders are placed here.</p></div>
    <Link href="/markets">Public market comparison</Link>
   </div>
   {!ready?<div className={ui.status} role="status" data-portfolio-migration="pending">
     <strong>Portfolio privacy cutover pending</strong>
     <p>Personal holdings and watchlists are withheld until the original public
       Power Stack data source has been retired and the private snapshot is verified.
       A Google login alone cannot secure information still hosted publicly.</p>
     <p>Automatic tracking of quantities and account value is not active.
       Existing market-monitor updates continue independently, but cannot
       validate a broker balance or reconstruct an unverified holding.</p>
   </div>:<>
    <div className={ui.metrics}>
     <div><small>Recorded holdings</small><strong>{holdings.length}</strong><span>Private snapshot</span></div>
     <div><small>Research watchlist</small><strong>{watchlist.length}</strong><span>Saved candidates</span></div>
     <div><small>Quote coverage</small><strong>{observed}/{holdings.length}</strong><span>Source-dated monitor</span></div>
    </div>
    {advice?<section className={ui.advisor} data-portfolio-advisor="archived-not-live">
      <p className={ui.kicker}>Recorded investment decisions · {advice.asOf||"undated"}</p>
      <h3>{advice.headline||"Investment review"}</h3>
      <p>{advice.summary}</p>
      <div className={ui.advisorCapital}>
       <strong>{advice.capitalMYR===null?"Capital unverified":
        `RM ${advice.capitalMYR.toLocaleString("en-MY",{maximumFractionDigits:2})}`}</strong>
       <span>Archived investment mandate · cash verified: {advice.cashVerified?"yes":"no"}
        {" · "}positions reconciled: {advice.positionsVerified?"yes":"no"}</span>
      </div>
      <div className={ui.advisorMoves}>{advice.moves.map((move,i)=><article key={i}>
        <h4>{move.title}</h4><p>{move.description}</p>
        <p><strong>Recorded next step:</strong> {move.next||"Not recorded"}</p>
        <p><strong>Wait for:</strong> {move.notYet||"Independent validation"}</p>
      </article>)}</div>
      <small>This is a dated archived briefing. It is not an automatically updated buy/sell recommendation.</small>
    </section>:null}
    <p className={ui.vintage}>Portfolio snapshot: {snapshot?.snapshot_as_of||"date unavailable"}.
      Market observations are refreshed from Bluebelly's existing market monitor when
      this page is loaded; they are not live brokerage quotes. Quantities, cost bases,
      allocations and account cash do not update automatically.</p>
    <div className={ui.tableWrap}><table className={ui.table}>
      <thead><tr><th>Holding</th><th>Recorded quantity</th><th>Recorded price</th><th>Observed price</th>
       <th>1D</th><th>3D</th><th>5D</th><th>Market session</th></tr></thead>
      <tbody>{holdings.map(holding=>{
       const market=latest(tape.get(holding.ticker));
       return <tr key={holding.ticker}><th scope="row">{holding.ticker}<span>{holding.name}</span></th>
        <td>{holding.quantity??"—"}</td>
        <td>{holding.recordedPrice===null?"—":`${holding.currency} ${holding.recordedPrice.toLocaleString("en-GB")}`}
         <small>{holding.priceAsOf||"Undated"}</small></td>
        <td>{market?.last?.toLocaleString("en-GB",{maximumFractionDigits:3})??"—"}</td>
        {([market?.change??null,market?.change3d??null,market?.change5d??null] as const)
          .map((v,i)=><td key={i} data-direction={v===null?"unknown":v>0?"up":v<0?"down":"flat"}>{showChange(v,market?.changeUnit||"%")}</td>)}
        <td>{market?.asOf||"Unavailable"}<small>{market?.sourceName||"No matching market quote"}</small></td>
       </tr>;
      })}</tbody>
     </table></div>
    {holdings.length===0?<p className={ui.vintage}>No validated holdings in this private snapshot.</p>:null}
    <details className={ui.watchlist}>
     <summary>Research watchlist · {watchlist.length} candidates</summary>
     <div className={ui.watchGrid}>{watchlist.map(asset=><article key={asset.ticker}>
      <strong>{asset.ticker} <span>{asset.name}</span></strong>
      <small>{asset.rank===null?"Unranked":`Research rank #${asset.rank}`} · {asset.theme||"Theme not recorded"}</small>
      <details><summary>Entry and invalidation</summary>
       <p><b>Entry:</b> {asset.entry||"Not recorded"}</p>
       <p><b>Invalidation:</b> {asset.invalidation||"Not recorded"}</p>
      </details>
     </article>)}</div>
    </details>
    <p className={ui.vintage}>These are archived research observations, not automatically recalculated
      positions or actionable trading signals. Source-date alignment and independent verification
      remain necessary before investment decisions.</p>
   </>}
  </section>;
}
