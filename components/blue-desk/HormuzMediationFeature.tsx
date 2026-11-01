import Link from "next/link";
import s from "./HormuzMediationFeature.module.css";

type Mode = "preview" | "full";

const SOURCE = {
  reuters: "https://www.reuters.com/world/middle-east/iranian-negotiators-doha-continue-talks-end-us-iran-war-official-says-2026-11-01/",
  aljazeera: "https://www.aljazeera.com/news/2026/11/1/mediators-continue-us-iran-negotiations-amid-war-rhetoric-what-we-know",
  qatar: "https://mofa.gov.qa/en/latest-articles/statements/qatar-condemns-attack-on-lng-carrier-in-arabian-gulf",
  nakilat: "https://qna.org.qa/en/news/news-details?date=1%2F11%2F2026&id=qatar-gas-transport-company-announces-one-of-its-vessels-attacked-in-arabian-gulf",
} as const;

/**
 * A bounded, source-dated public editorial feature. This is not a canonical
 * Dossier verdict, proof of a shipping reopening, or an inferred price move.
 */
export default function HormuzMediationFeature({
  mode = "full",
  storyHref = "/key-stories?feature=hormuz-mediation-november-2026",
}: {
  mode?: Mode;
  storyHref?: string;
}) {
  const preview = mode === "preview";
  return (
    <article
      className={preview ? s.preview : s.feature}
      data-hormuz-mediation={preview ? "source-reviewed-preview" : "source-reviewed-key-story"}
      aria-labelledby="hormuz-mediation-title"
    >
      <div className={s.eyebrow}>HORMUZ DIPLOMACY / QATAR MEDIATION · REPORTED 1 NOV 2026</div>
      <h2 id="hormuz-mediation-title">Iran offers a two-day Hormuz reopening. What is the catch?</h2>
      <p className={s.deck}>
        Tehran says it could restore navigation on day two of a proposed deal, but only after
        the US acts on Iranian conditions on day one. A proposal is not an agreement,
        and safer navigation has not yet been established.
      </p>
      <div className={s.statusRow} aria-label="Story status">
        <span>MEDIATION REPORTED</span>
        <span>US ACCEPTANCE NOT CONFIRMED</span>
        <span>REOPENING NOT VERIFIED</span>
      </div>
      <div className={s.sequence}>
        <div><b>01 / US ACTION</b><p>Under Iran's proposed sequence, Washington first implements agreed measures. The parties have not announced final terms.</p></div>
        <div><b>02 / IRAN ACTION</b><p>Tehran says it would then reopen the strait and restore maritime navigation. This remains conditional.</p></div>
        <div><b>03 / PHYSICAL TEST</b><p>Verify actual ship passages, sustained traffic, insurance conditions and fuel deliveries before calling the route normal.</p></div>
      </div>
      <div className={s.conflict}>
        <div>
          <h3>The negotiation</h3>
          <p>Qatari mediators and Iranian negotiators met in Doha for a third day on 1 November, with Pakistani diplomacy also involved. Iran's stated demands include sanctions and oil-export relief, changes to US military posture, shipping arrangements with Oman, and broader de-escalation. Washington has expressed openness to diplomacy, but has not publicly accepted this package.</p>
          <p><a href={SOURCE.reuters} target="_blank" rel="noopener noreferrer">Reuters · Doha talks, 1 Nov ↗</a>{" · "}<a href={SOURCE.aljazeera} target="_blank" rel="noopener noreferrer">Araghchi's proposed conditions ↗</a></p>
        </div>
        <div>
          <h3>The contradiction: a mediator's tanker was struck</h3>
          <p>Qatar condemned an attack on its LNG carrier <em>Al Mayeda</em>, which was hit by unidentified objects in the Arabian Gulf on 30 October. The operator said the crew was unharmed and the ship remained operational. Responsibility was still under investigation as of Qatar's 1 November statement.</p>
          <p><a href={SOURCE.qatar} target="_blank" rel="noopener noreferrer">Qatar Foreign Ministry · 1 Nov ↗</a>{" · "}<a href={SOURCE.nakilat} target="_blank" rel="noopener noreferrer">Nakilat via Qatar News Agency ↗</a></p>
        </div>
      </div>
      {preview ? (
        <div className={s.footer}>
          <p><strong>What changes the oil story?</strong> A deal could reduce risk premiums, but traffic, insurance and diesel spreads must confirm real relief.</p>
          <Link className={s.readMore} href={storyHref}>Read the full mediation story and market tests →</Link>
        </div>
      ) : (
        <>
          <section className={s.detail}>
            <h3>Why would oil fall on a deal if supply is still damaged?</h3>
            <p>Brent contains an element of risk: buyers pay more when they worry future deliveries may be disrupted. A credible reopening could reduce that fear before every vessel or refinery returns to normal. But a diplomatic headline does not produce diesel, repair damaged equipment or automatically make tankers insurable.</p>
            <p>That makes refined fuels important. If crude eases while diesel cracks stay elevated, traders may be pricing less geopolitical risk without seeing the same improvement in finished-fuel availability.</p>
          </section>
          <section className={s.tests}>
            <h3>The next three decisions</h3>
            <div>
              <div><strong>Diplomatic confirmation</strong><p>Look for a documented US response, agreed conditions and an implementation date. No response is not a deal.</p></div>
              <div><strong>Maritime confirmation</strong><p>Look for multi-day recovered crossings, verified cargo delivery and easing security/insurance restrictions. AIS counts are neither complete cargo records nor oil volumes.</p></div>
              <div><strong>Market confirmation</strong><p>Compare source-dated Brent, diesel/gasoil cracks, tanker conditions and inventories. Reconcile the price timestamps before assigning a move to these talks.</p></div>
            </div>
          </section>
          <p className={s.verdict}><strong>Working verdict:</strong> A serious diplomatic opening, not a verified reopening. The strongest countercase is another maritime attack or failure to agree on US concessions; the strongest confirmation is an implemented arrangement followed by sustained safer passage.</p>
          <p className={s.sourceNote}>Editorial snapshot: developments publicly reported 1 November 2026. This article does not assert a new canonical Dossier thesis, live shipping normalisation, a verified oil-price reaction or resolution of the Al Mayeda investigation.</p>
          <Link className={s.readMore} href="/hormuz">Open the source-dated Hormuz traffic and fuel tracker →</Link>
        </>
      )}
    </article>
  );
}
