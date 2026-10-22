import { storyIdentityBalls } from "@/lib/blue-desk/story-identity";
import styles from "@/app/blue-desk/blue-desk.module.css";

export default function StoryIdentityBalls({title,deck}:{title:string;deck:string}) {
  const balls=storyIdentityBalls(title,deck);
  if(!balls.length)return null;
  return <div className={styles.storyIdentities} aria-label="Countries and companies explicitly mentioned">
    {balls.map(ball=><span key={ball.kind+ball.code}
      className={`${styles.identityBall} ${ball.kind==="country"?styles.identityCountry:styles.identityCompany}`}
      role="img" aria-label={ball.label} title={ball.label}>
      {ball.kind==="company"?<span className={styles.identityFallback} aria-hidden="true">{ball.code}</span>
        :<span className={styles.identityFallback} aria-hidden="true">{ball.code}</span>}
      {/* Visual identity only; unavailable third-party favicons leave a legible code. */}
      <img src={ball.imageUrl} loading="lazy" alt="" aria-hidden="true" referrerPolicy="no-referrer" />
    </span>)}
  </div>;
}
