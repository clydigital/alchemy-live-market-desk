"use client";
import Script from "next/script";
import {useRef} from "react";
export default function EditorialFeatureTweets({kind}:{kind:"amazon"|"fomc"}){
 const ref=useRef<HTMLDivElement>(null);
 const fed=kind==="fomc";
 const url=fed?"https://x.com/federalreserve/status/2115504207977435556":"https://x.com/KobeissiLetter/status/2115535656105496959";
 return <section ref={ref} aria-label="Editorially selected original X post" style={{marginTop:32}}>
  <h3>{fed?"The Fed's own announcement":"The conversation Amazon follows"}</h3>
  <p>{fed?"Official Federal Reserve post · 28 October 2026, 14:01 ET. The linked statement supplies the policy evidence.":"The Kobeissi Letter · 28 October 2026, 16:06 ET. An attributed Alphabet reaction claim, not an Amazon result, a representative sentiment survey or independently verified price measurement."}</p>
  <blockquote className="twitter-tweet" data-theme="dark" data-conversation="none" data-dnt="true"><a href={url} target="_blank" rel="noopener noreferrer">Open the original post ↗</a></blockquote>
  <p><a href={url} target="_blank" rel="noopener noreferrer">Read on X if the embed is unavailable ↗</a></p>
  <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" onReady={()=>{if(ref.current)window.twttr?.widgets?.load(ref.current);}}/>
 </section>;
}
