"use client";

import {useId} from "react";

/** First-party vector countryball. No platform-dependent flag emoji or remote asset. */
type CountryCode="US"|"CA"|"NZ";
const NAMES:Record<CountryCode,string>={US:"United States",CA:"Canada",NZ:"New Zealand"};
export default function BankCountryBall({code,size="md",className=""}:{
 code:CountryCode;size?:"sm"|"md"|"lg";className?:string
}){
 const uid=useId().replace(/:/g,"");
 const clip="flag-circle-"+uid,gloss="flag-shine-"+uid;
 const pixels=size==="sm"?38:size==="lg"?68:54;
 return <svg width={pixels} height={pixels} viewBox="0 0 160 160" role="img"
   aria-label={NAMES[code]+" countryball"} className={className}
   data-countryball-svg={code} xmlns="http://www.w3.org/2000/svg">
   <defs>
    <clipPath id={clip}><circle cx="80" cy="80" r="69"/></clipPath>
    <linearGradient id={gloss} x1="0%" y1="0%" x2="95%" y2="100%">
     <stop offset="0%" stopColor="#fff" stopOpacity=".25"/>
     <stop offset="45%" stopColor="#fff" stopOpacity=".03"/>
     <stop offset="100%" stopColor="#000" stopOpacity=".22"/>
    </linearGradient>
   </defs>
   <circle cx="81" cy="86" r="72" fill="#001927" opacity=".45"/>
   <g clipPath={`url(#${clip})`}>
    {code==="US"?<>
     <rect width="160" height="160" fill="#f5eee5"/>
     {Array.from({length:8},(_,i)=><rect key={i} x="0" y={5+i*20}
       width="160" height="10" fill="#c6384a"/>)}
     <rect x="0" y="4" width="84" height="78" fill="#1e4775"/>
     {Array.from({length:16},(_,i)=><circle key={i} cx={12+(i%4)*19}
       cy={14+Math.floor(i/4)*17} r="2.3" fill="#fff3dd"/>)}
    </>:code==="CA"?<>
     <rect width="160" height="160" fill="#f9f5ed"/>
     <rect width="52" height="160" fill="#d3303a"/>
     <rect x="108" width="52" height="160" fill="#d3303a"/>
     <path fill="#d3303a" d="M80 36L88 56L101 50L98 63L113 70L98 78L104 90L88 88L84 106L76 106L72 88L56 90L63 78L47 70L62 63L59 50L72 56Z"/>
     <path d="M80 100V129" stroke="#d3303a" strokeWidth="5"/>
    </>:<>
     <rect width="160" height="160" fill="#164275"/>
     <path d="M0 5L80 83M78 5L0 83" stroke="#e7edf6" strokeWidth="16"/>
     <path d="M0 5L80 83M78 5L0 83" stroke="#d93a4c" strokeWidth="6"/>
     <path d="M39 0V85M0 43H87" stroke="#e7edf6" strokeWidth="19"/>
     <path d="M39 0V85M0 43H87" stroke="#c9374b" strokeWidth="9"/>
     {[[109,37],[127,67],[118,115],[90,91]].map(([x,y],i)=><g key={i}>
       <circle cx={x} cy={y} r="9" fill="#f5eade"/>
       <path d={`M${x} ${y-8}l2.4 5.5 6 .6-4.5 3.9 1.4 5.8-5.3-3.1-5.3 3.1 1.4-5.8-4.5-3.9 6-.6Z`}
        fill="#dc4150"/>
      </g>)}
    </>}
    <circle cx="80" cy="80" r="69" fill={`url(#${gloss})`}/>
   </g>
   <circle cx="80" cy="80" r="69" fill="none" stroke="#d2e8ee" strokeWidth="4.5"/>
   <ellipse cx="59" cy="75" rx="21" ry="25" fill="#fefdf9" stroke="#0d2c3d" strokeWidth="4" transform="rotate(-6 59 75)"/>
   <ellipse cx="103" cy="76" rx="21" ry="25" fill="#fefdf9" stroke="#0d2c3d" strokeWidth="4" transform="rotate(5 103 76)"/>
   <ellipse cx="65" cy="79" rx="5.8" ry="8" fill="#102c3c"/>
   <ellipse cx="98" cy="80" rx="5.8" ry="8" fill="#102c3c"/>
   <path d="M35 41Q59 19 87 20" stroke="#fff" strokeOpacity=".45"
     strokeWidth="5" fill="none" strokeLinecap="round"/>
  </svg>;
}
