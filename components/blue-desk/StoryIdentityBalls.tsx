import Link from "next/link";
import { storyIdentityBalls } from "@/lib/blue-desk/story-identity";
import styles from "@/app/blue-desk/blue-desk.module.css";

type Props={title:string;deck:string;assets?:readonly string[];hrefBase?:string;limit?:number};
export default function StoryIdentityBalls({title,deck,assets=[],hrefBase,limit=3}:Props){
 const balls=storyIdentityBalls(title,deck,limit,assets);
 if(!balls.length)return null;
 return <div className={styles.storyIdentities} aria-label="Referenced countries, companies and markets">
  {balls.map(ball=>{
   const badge=<span className={`${styles.identityBall} ${ball.kind==="country"?styles.identityCountry:ball.kind==="company"?styles.identityCompany:styles.identityAsset}`}
      role="img" aria-label={ball.label} title={ball.label}>
      <span className={styles.identityFallback} aria-hidden="true">{ball.code}</span>
      {ball.imageUrl?<img src={ball.imageUrl} loading="lazy" alt="" aria-hidden="true" referrerPolicy="no-referrer"/>:null}
   </span>;
   return hrefBase?<Link className={styles.identityLink} key={ball.kind+ball.code}
     title={"Filter related stories: "+ball.label} aria-label={"Filter stories by "+ball.label}
     href={hrefBase+"?subject="+encodeURIComponent(ball.code)}>{badge}</Link>:
     <span className={styles.identityLink} key={ball.kind+ball.code}>{badge}</span>;
  })}
 </div>;
}