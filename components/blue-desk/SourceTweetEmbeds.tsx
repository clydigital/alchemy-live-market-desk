import Script from "next/script";
import type {EmbeddedSocialContext} from "@/lib/bluebelly-event-social";
import s from "./SourceTweetEmbeds.module.css";

/**
 * Published platform embeds, supplied exclusively by bounded accepted source
 * leads and strict X post URL validation. Tweet content is opinion/context,
 * NEVER original proof of the central-bank announcement.
 */
export default function SourceTweetEmbeds({posts,sourceLink}:{posts:readonly EmbeddedSocialContext[];sourceLink:string}){
 return <section className={s.root} aria-label="Dated market conversation on X" data-news-social="not-bank-verification">
  <div className={s.head}><span>SOCIAL CONTEXT · UNVERIFIED COMMENTARY</span><h3>What traders were saying</h3>
   <p>Source-attributed X posts, automatically matched by topic and timestamp. These are not official decisions, verified facts, or evidence of market impact.</p></div>
  {posts.length?<div className={s.posts}>
   {posts.map(post=><article className={s.post} key={post.id}>
    <div className={s.meta}><strong>@{post.handle}</strong><small>{post.phase}</small></div>
    <blockquote className="twitter-tweet" data-theme="dark" data-conversation="none"
      data-dnt="true" data-cards="hidden">
     <a href={post.url} target="_blank" rel="noopener noreferrer">Read the dated X post from @{post.handle} ↗</a>
    </blockquote>
    <p className={s.fallback}><a href={post.url} target="_blank" rel="noopener noreferrer">Open original post if embed is unavailable ↗</a></p>
   </article>)}
   <Script src="https://platform.twitter.com/widgets.js" strategy="lazyOnload"/>
  </div>:<div className={s.empty}>No eligible original X posts currently match this decision’s source and time window. The official statement remains the authoritative evidence.
   <a href={sourceLink} target="_blank" rel="noopener noreferrer">Read the bank’s statement ↗</a></div>}
 </section>;
}
