import s from "./AcceleratorDial.module.css";

type Props={
 label:string;direction:-1|0|1|null;leftLabel:string;rightLabel:string;
 compact?:boolean;
};
/** Tachometer-style ordinal direction. Needle positions are categorical, not measured scores. */
const polar=(degree:number,radius:number)=>{
 const rad=(degree-90)*Math.PI/180;
 return [(90+radius*Math.cos(rad)).toFixed(2),(90+radius*Math.sin(rad)).toFixed(2)];
};
const arc=(from:number,to:number,radius:number)=>{
 const [x1,y1]=polar(from,radius),[x2,y2]=polar(to,radius);
 return `M ${x1} ${y1} A ${radius} ${radius} 0 ${Math.abs(to-from)>180?1:0} 1 ${x2} ${y2}`;
};
export default function AcceleratorDial({label,direction,leftLabel,rightLabel,compact=false}:Props){
 const angle=direction===null?-104:direction*70;
 const state=direction===null?"unknown":direction===1?"rising":direction===-1?"falling":"unchanged";
 return <div className={compact?s.compact:s.dial} data-accelerator-dial={state}>
  <svg viewBox="0 0 180 123" role="img"
    aria-label={`${label}: ${direction===null?"unavailable or stale":direction===1?rightLabel:direction===-1?leftLabel:"little weekly change"}. Direction only, not a probability.`}>
   <path d={arc(-106,106,68)} className={s.rail}/>
   <path d={arc(-104,-38,68)} className={s.leftArc}/>
   <path d={arc(-34,34,68)} className={s.middleArc}/>
   <path d={arc(38,104,68)} className={s.rightArc}/>
   {[-100,-80,-60,-40,-20,0,20,40,60,80,100].map(deg=>{
    const [x1,y1]=polar(deg,55),[x2,y2]=polar(deg,62);
    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} className={s.tick}/>;
   })}
   {direction!==null?<g transform={`rotate(${angle} 90 94)`}>
     <line x1="90" y1="104" x2="90" y2="38" className={s.needle}/>
    </g>:null}
   <circle cx="90" cy="94" r="8" className={s.hub}/>
   <text x="90" y="119" textAnchor="middle" className={s.readText}>
     {direction===null?"NO READING":direction===1?"RISING":direction===-1?"FALLING":"UNCHANGED"}
   </text>
  </svg>
  <div className={s.extremes}><small>{leftLabel}</small><small>{rightLabel}</small></div>
 </div>;
}
