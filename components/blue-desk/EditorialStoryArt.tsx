import type { EditorialMotif } from "@/lib/bluebelly-editorial-visuals";
import { editorialMotif } from "@/lib/bluebelly-editorial-visuals";
import styles from "./EditorialStoryArt.module.css";

/** First-party vector illustration. No observed prices, logos or event depiction. */
export default function EditorialStoryArt({
  headline, summary = "", motif, compact = false,
}: {headline: string; summary?: string; motif?: EditorialMotif; compact?: boolean}) {
  const key = motif || editorialMotif(headline, summary);
  const name: Record<EditorialMotif,string> = {
    fed:"CENTRAL BANKS",bonds:"SOVEREIGN BONDS",credit:"CREDIT / FUNDING",
    ai:"AI / COMPUTE",china:"CHINA / TECHNOLOGY",energy:"ENERGY / SHIPPING",
    lng:"LNG / SUPPLY",yen:"JAPAN / YEN",gold:"GOLD / RESERVES",
    equities:"EQUITIES / EARNINGS",other:"MARKET DEVELOPMENTS",
  };
  return <div className={compact ? styles.compact : styles.visual}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 425" role="img"
      aria-label={name[key] + " — stylised editorial illustration, not market data"}
      preserveAspectRatio="xMidYMid slice">
      <rect width="700" height="425" fill="#062f48"/>
      <path d="M0 0H700V425H0Z" fill="#03192a" opacity=".32"/>
      <g stroke="#a4e3ff" strokeWidth="1" opacity=".10">
        <path d="M0 85H700M0 170H700M0 255H700M0 340H700M100 0V425M200 0V425M300 0V425M400 0V425M500 0V425M600 0V425"/>
        <circle cx="370" cy="207" r="155" fill="none" strokeWidth="2"/>
        <circle cx="370" cy="207" r="205" fill="none"/>
      </g>
      <circle cx="370" cy="205" r="130" fill="#0f617a" opacity=".26"/>
      <g fill="none" stroke="#86daf4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
        {key==="ai" && <>
          <rect x="267" y="112" width="205" height="205" rx="24"/>
          <rect x="319" y="166" width="100" height="98" rx="9" stroke="#f3cb83"/>
          <path d="M294 82V112M351 82V112M410 82V112M449 82V112M294 317V347M351 317V347M410 317V347M449 317V347M237 143H267M237 201H267M237 263H267M472 143H502M472 201H502M472 263H502"/>
        </>}
        {(key==="fed" || key==="bonds") && <>
          <path d="M238 170L368 89L500 170M250 182H488M255 311H483M232 326H505" />
          <path d="M281 191V302M337 191V302M397 191V302M453 191V302"/>
          {key==="bonds" && <path d="M509 114L541 140L509 166" stroke="#efcd95"/>}
          {key==="fed" && <circle cx="367" cy="145" r="12" fill="#efcd95" stroke="none"/>}
        </>}
        {key==="credit" && <>
          <rect x="235" y="110" width="195" height="220" rx="15"/>
          <path d="M270 162H395M270 215H395M270 268H350M430 159L504 230L430 299M500 231H379" stroke="#f3cb83"/>
        </>}
        {key==="china" && <>
          <circle cx="367" cy="208" r="112"/>
          <path d="M255 208H479M367 96V320M293 121C364 192 364 242 293 295M443 121C372 192 372 242 443 295"/>
          <path d="M486 134L510 110M486 284L516 312" stroke="#f3cb83"/>
        </>}
        {key==="energy" && <>
          <path d="M203 240H521L482 300H253Z"/>
          <path d="M285 184H460V240H285ZM329 158H416V184M190 329Q231 303 270 329T350 329T430 329T510 329T560 329"/>
          <path d="M500 201H541" stroke="#f3cb83"/>
        </>}
        {key==="lng" && <>
          <path d="M219 305V187Q219 131 273 131Q327 131 327 187V305ZM345 305V187Q345 131 399 131Q453 131 453 187V305ZM475 305V187Q475 149 511 149"/>
          <path d="M205 320H530M245 204H301M370 204H425" stroke="#f3cb83"/>
        </>}
        {key==="yen" && <>
          <circle cx="370" cy="208" r="122"/>
          <path d="M305 140L370 217L435 140M370 217V286M322 222H420M322 246H420" stroke="#f3cb83"/>
        </>}
        {key==="gold" && <>
          <path d="M210 268H490L514 327H186ZM267 183H447L476 258H237ZM318 114H403L424 175H297Z"/>
          <path d="M307 235H404M324 297H400" stroke="#f3cb83"/>
        </>}
        {key==="equities" && <>
          <path d="M216 318V203H270V318M282 318V140H355V318M367 318V188H430V318M444 318V111H505V318M204 330H518"/>
          <path d="M303 175H333M386 219H409M460 145H485" stroke="#f3cb83"/>
        </>}
        {key==="other" && <>
          <circle cx="372" cy="202" r="79"/>
          <circle cx="239" cy="156" r="26"/><circle cx="505" cy="141" r="26"/><circle cx="493" cy="317" r="26"/><circle cx="253" cy="312" r="26"/>
          <path d="M267 166L301 178M444 170L476 150M445 254L468 296M296 262L277 291" stroke="#f3cb83"/>
        </>}
      </g>
      <path d="M0 405H700" stroke="#f1c98e" strokeWidth="2" opacity=".65"/>
      <text x="29" y="45" fill="#c9efff" fontFamily="Arial,sans-serif" fontSize="14" fontWeight="700" letterSpacing="2.6">{name[key]}</text>
      <text x="29" y="389" fill="#aacddd" fontFamily="Arial,sans-serif" fontSize="10" letterSpacing="1.4">BLUEBELLY · EDITORIAL ILLUSTRATION · NOT MARKET DATA</text>
    </svg>
  </div>;
}
