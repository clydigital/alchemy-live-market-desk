"use client";
import Script from "next/script";
import {useRef} from "react";
import type {EmbeddedSocialContext} from "@/lib/bluebelly-event-social";
import s from "./StoryXContext.module.css";

/** Discovery-only commentary, never a fact-check or proof of a price reaction. */
export default function StoryXContext({posts}:{posts:readonly EmbeddedSocialContext[]}){
 const ref=useRef<HTMLDivElement>(null);
 if(!posts.length)return null;
 return <aside ref={ref} className={s.social} data-story-x-context="unverified">
  <p className={s.eyebrow}>ORIGINAL X POSTS · UNVERIFIED COMMENTARY</p>
  {posts.map(post=><div key={post.id} className={s.post}>
    <p className={s.meta}>@{post.handle} · <time dateTime={post.postedAt}>
      {new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(post.postedAt))} ET
    </time></p>
    <blockquote className="twitter-tweet" data-theme="dark" data-conversation="none" data-dnt="true">
      <a href={post.url} target="_blank" rel="noopener noreferrer">Original dated X post from @{post.handle}</a>
    </blockquote>
    <a className={s.fallback} href={post.url} target="_blank" rel="noopener noreferrer">Open original post if embed is blocked ↗</a>
  </div>)}
  <small className={s.disclaimer}>Post attribution does not verify market claims or establish that the event caused a price move.</small>
  <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload"
    onReady={()=>{if(ref.current)window.twttr?.widgets?.load(ref.current);}}/>
 </aside>;
}
