"use client";

import Script from "next/script";
import {useRef} from "react";
import type {EmbeddedSocialContext} from "@/lib/bluebelly-event-social";
import s from "./SourceTweetEmbeds.module.css";

declare global { interface Window { twttr?:{widgets?:{load:(container?:HTMLElement)=>void}} } }

/**
 * Published platform embeds, supplied exclusively by bounded accepted source
 * leads and strict X post URL validation. Tweet content is opinion/context,
 * NEVER original proof of the central-bank announcement.
 */
export default function SourceTweetEmbeds({posts,sourceLink}:{posts:readonly EmbeddedSocialContext[];sourceLink:string}){
 const containerRef=useRef<HTMLDivElement>(null);
 const hydrateEmbeds=()=>{if(containerRef.current)window.twttr?.widgets?.load(containerRef.current);};
 return <section className={s.root} aria-label="Dated market conversation on X" data-news-social="not-bank-verification">
  <div className={s.head}><span>SOCIAL CONTEXT · UNVERIFIED COMMENTARY</span><h3>What traders were saying</h3>
   <p>Source-attributed X posts, automatically matched by topic and timestamp. These are not official decisions, verified facts, or evidence of market impact.</p></div>
  {posts.length?<div className={s.posts} ref={containerRef}>
   {posts.map(post=><article className={s.post} key={post.id}>
    <div className={s.meta}><strong>@{post.handle}</strong><small>{post.phase}</small></div>
    <p className={s.date}><time dateTime={post.postedAt}>
      {new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(post.postedAt))} ET
    </time> · Captured post excerpt, not fact-checked</p>
    <p className={s.snapshot}>“{post.caption}{post.caption.split(/\s+/).length>=22?"…":""}”</p>
    <blockquote className="twitter-tweet" data-theme="dark" data-conversation="none"
      data-dnt="true" data-cards="hidden">
     <a href={post.url} target="_blank" rel="noopener noreferrer">Read the dated X post from @{post.handle} ↗</a>
    </blockquote>
    <p className={s.fallback}><a href={post.url} target="_blank" rel="noopener noreferrer">Open original post if embed is unavailable ↗</a></p>
   </article>)}
   <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload" onReady={hydrateEmbeds}/>
  </div>:<div className={s.empty}>No eligible original X posts currently match this decision’s source and time window. The official statement remains the authoritative evidence.
   <a href={sourceLink} target="_blank" rel="noopener noreferrer">Read the bank’s statement ↗</a></div>}
 </section>;
}
