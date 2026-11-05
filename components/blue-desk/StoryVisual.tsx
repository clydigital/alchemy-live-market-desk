import { storyVisualDescriptor } from "@/lib/blue-desk-story-visual";
import styles from "./story-visual.module.css";

type StoryVisualProps = {
  storyId: string;
  editionId: string;
  category: string;
};

function SubjectMark({ kind }: { kind: "rates" | "energy" | "equities" | "cross-asset" }) {
  // One allowlisted symbol per market category. No external asset, HTML
  // injection, live series, or visual inference from a thesis.
  if (kind === "rates") {
    return (
      <g fill="none" stroke="#daf6ff" strokeWidth="4.2" strokeLinecap="round">
        <rect x="-57" y="-43" width="114" height="86" rx="13" fill="#0d4b6e" />
        <path d="M-35 -18 H35 M-35 0 H19 M-35 18 H35" />
        <circle cx="36" cy="0" r="4.5" fill="#a1ebff" stroke="none" />
      </g>
    );
  }
  if (kind === "energy") {
    return (
      <g fill="none" stroke="#daf6ff" strokeWidth="4.5" strokeLinejoin="round">
        <path d="M0 -64 C15 -35 45 -12 45 16 A45 45 0 0 1 -45 16 C-45 -12 -15 -35 0 -64Z" fill="#0b5375" />
        <path d="M-23 18 C-22 30 -13 38 -1 40" strokeLinecap="round" />
      </g>
    );
  }
  if (kind === "equities") {
    return (
      <g fill="none" stroke="#daf6ff" strokeWidth="4" strokeLinejoin="round">
        <rect x="-48" y="-48" width="96" height="96" rx="12" fill="#0b4a6e" />
        <rect x="-27" y="-27" width="54" height="54" rx="5" stroke="#b0efff" />
        {[-27, 0, 27].map(offset => (
          <g key={offset}>
            <path d={"M" + offset + " -62 V-48 M" + offset + " 48 V62"} />
            <path d={"M-62 " + offset + " H-48 M48 " + offset + " H62"} />
          </g>
        ))}
      </g>
    );
  }
  return (
    <g fill="none" stroke="#daf6ff" strokeWidth="4" strokeLinejoin="round">
      <circle r="51" fill="#0c4768" />
      <path d="M0 -66 V-47 M0 47 V66 M-66 0 H-47 M47 0 H66" strokeLinecap="round" />
      <path d="M0 -39 12 -12 39 0 12 12 0 39 -12 12 -39 0 -12 -12Z" fill="#8de2f7" stroke="none" />
      <circle r="9" fill="#04415d" stroke="none" />
    </g>
  );
}

/**
 * Static editorial art for exact immutable Story editions. All SVG geometry
 * is React-authored; offsets only decorate a sonar motif. No axes or prices.
 */
export default function StoryVisual({ storyId, editionId, category }: StoryVisualProps) {
  const visual = storyVisualDescriptor({ storyId, editionId, category });
  if (!visual) return null;
  const { id, orbX, orbY, orbitTilt, label, kind, accents } = visual;

  return (
    <figure className={styles.figure} data-story-visual-version={visual.visualVersion}>
      <svg
        className={styles.illustration}
        viewBox="0 0 1040 315"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-labelledby={id + "-title " + id + "-description"}
        focusable="false"
      >
        <title id={id + "-title"}>{label} — Blue Desk conceptual artwork</title>
        <desc id={id + "-description"}>
          Decorative, underwater bathymetric contours and a sonar emblem.
          This does not show measured prices, yield changes, a forecast or an accepted causal relationship.
        </desc>
        <defs>
          <linearGradient id={id + "-sea"} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#001b2c" />
            <stop offset="55%" stopColor="#07405b" />
            <stop offset="100%" stopColor="#012038" />
          </linearGradient>
          <radialGradient id={id + "-halo"}>
            <stop offset="0%" stopColor="#1173a1" stopOpacity=".48" />
            <stop offset="65%" stopColor="#0b668e" stopOpacity=".18" />
            <stop offset="100%" stopColor="#054466" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id + "-orb"} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38b9d5" />
            <stop offset="56%" stopColor="#126f9a" />
            <stop offset="100%" stopColor="#093954" />
          </linearGradient>
          <clipPath id={id + "-bounds"}>
            <rect width="1040" height="315" rx="14" />
          </clipPath>
        </defs>
        <g clipPath={"url(#" + id + "-bounds)"}>
          <rect width="1040" height="315" rx="14" fill={"url(#" + id + "-sea)"} />
          <circle cx={orbX} cy={orbY} r="290" fill={"url(#" + id + "-halo)"} />
          <g fill="none" stroke="#2c91b7" strokeWidth="1.1" strokeOpacity=".30">
            {Array.from({ length: 9 }, (_, i) => (
              <ellipse
                key={i}
                cx={205 - i * 7}
                cy={318 + i * 11}
                rx={190 + i * 100}
                ry={58 + i * 45}
                transform={"rotate(" + orbitTilt + " 205 265)"}
              />
            ))}
          </g>
          <path d="M0 257 Q216 223 402 257 T1040 255" fill="none" stroke="#2e8eaf" strokeOpacity=".36" strokeWidth="1.1" />
          {accents.map((dot, i) => (
            <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill="#a7e6f8" opacity=".44" />
          ))}
          <g transform={"translate(" + orbX + " " + orbY + ")"}>
            <circle r="144" stroke="#6dcfe7" strokeOpacity=".20" strokeWidth="1" strokeDasharray="3 9" fill="none" />
            <circle r="122" stroke="#6dcfe7" strokeOpacity=".22" strokeWidth="1.2" fill="none" />
            <circle r="97" fill={"url(#" + id + "-orb)"} fillOpacity=".78" stroke="#79d8ee" strokeOpacity=".5" strokeWidth="1.5" />
            <circle r="82" fill="#031f34" fillOpacity=".44" stroke="#75d5ea" strokeOpacity=".38" />
            <SubjectMark kind={kind} />
          </g>
          <path d="M38 40 H105" stroke="#3dbbdb" strokeWidth="3" strokeLinecap="round" />
          <text x="38" y="79" fill="#bceaf8" fontSize="14" fontWeight="750" letterSpacing="3" fontFamily="Arial,sans-serif">
            BLUE DESK
          </text>
          <text x="38" y="122" fill="#f2fbff" fontSize="30" fontWeight="700" letterSpacing="-.6" fontFamily="Arial,sans-serif">
            {label}
          </text>
          <text x="38" y="155" fill="#a9d1e1" fontSize="12" letterSpacing="2.1" fontFamily="Arial,sans-serif">
            CONCEPTUAL STUDY
          </text>
          <path d="M38 175 H305" stroke="#55b8d5" strokeOpacity=".34" />
        </g>
      </svg>
      <figcaption className={styles.caption}>
        Illustrative category artwork. Not a market chart, observed move or evidence of the Story&apos;s explanation.
      </figcaption>
    </figure>
  );
}
