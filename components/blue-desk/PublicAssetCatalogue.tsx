import Link from "next/link";
import type {CataloguePage,CatalogueScope} from "@/lib/bluebelly-public-asset-catalogue";
import css from "./PublicAssetCatalogue.module.css";

export default function PublicAssetCatalogue({
  data,baseHref,
}:{data:CataloguePage;baseHref:string}){
  const link=(page:number,scope:CatalogueScope=data.scope)=>{
    const params=new URLSearchParams({mode:"assets","catalogue-scope":scope});
    if(data.query)params.set("catalogue-q",data.query);
    if(page>1)params.set("catalogue-page",String(page));
    return baseHref+"?"+params.toString()+"#asset-directory";
  };
  return <details id="asset-directory" className={css.directory} data-public-asset-catalogue="identity-only"
    open={Boolean(data.query)||data.scope!=="additional"||data.page>1}>
    <summary>Discover more symbols <span>{data.catalogueCount} additional catalogue identities</span></summary>
    <div className={css.body}>
      <p className={css.intro}>The actively monitored instruments remain in the sortable table above. This additional directory finds recognised ETF and FX identities; it does not claim a live quote, verified provider mapping or a tradeable instrument on this venue.</p>
      <div className={css.coverage}>
        <span><strong>{data.monitoredCount}</strong> monitored identifiers</span>
        <span><strong>{data.pricedCount}</strong> source-dated observations</span>
        <span><strong>{data.catalogueCount}</strong> catalogue-only references</span>
      </div>
      <form method="get" action={baseHref} className={css.search} role="search" aria-label="Asset directory search">
        <input type="hidden" name="mode" value="assets"/>
        <label>Search symbol or description
          <input type="search" name="catalogue-q" maxLength={64} defaultValue={data.query}
            placeholder="e.g. VTI, USDMYR, Treasury ETF" />
        </label>
        <label>Coverage
          <select name="catalogue-scope" defaultValue={data.scope}>
            <option value="additional">Additional identities</option>
            <option value="all">All indexed identities</option>
            <option value="monitored">Already monitored</option>
          </select>
        </label>
        <button type="submit">Find assets</button>
      </form>
      <p className={css.count} role="status">{data.filteredCount} matching identities · page {data.page} of {data.pages}. This is a curated public catalogue, not a universal exchange-symbol API.</p>
      {data.items.length?<div className={css.scroll}>
        <table><thead><tr><th scope="col">Symbol</th><th scope="col">Instrument</th><th scope="col">Class / venue</th><th scope="col">Data coverage</th></tr></thead>
          <tbody>{data.items.map(item=><tr key={item.id}>
            <th scope="row">{item.symbol}</th>
            <td>{item.label}</td>
            <td>{item.assetClass}{item.venue?" · "+item.venue:""}</td>
            <td>{item.status==="CATALOGUE_ONLY"?
                "Catalogue only · no approved quote":
                item.status==="MONITORED_UNAVAILABLE"?
                  "Monitored · observation unavailable":
                  <>Observed {item.asOf||"date unavailable"}{item.sourceUrl?<span> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">source</a></span>:null}</>}</td>
          </tr>)}</tbody>
        </table>
      </div>:<p className={css.empty}>No matching catalogue identity. An unsupported symbol is not treated as a zero-price instrument; try another spelling or the monitored table above.</p>}
      {data.pages>1?<nav className={css.paging} aria-label="Asset directory pages">
        {data.page>1?<Link href={link(data.page-1)}>Previous 15</Link>:<span>Previous 15</span>}
        <span>{data.page} / {data.pages}</span>
        {data.page<data.pages?<Link href={link(data.page+1)}>Next 15</Link>:<span>Next 15</span>}
      </nav>:null}
      <p className={css.foot}>Reference entries cannot be plotted, ranked or added to Divergence Watch until separate provider authorization, source-session history and instrument identity are verified. OTC FX symbols are pair identities, not executable prices.</p>
    </div>
  </details>;
}
