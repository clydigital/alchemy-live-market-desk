/** Presentation-only relative change lanes. These values are not history points. */
export type WindowUnit = "%"|"bp"|"pp";
export type WindowDirection = "up"|"down"|"flat"|"unknown";
export type WindowLane = {
  name:"1D"|"3D"|"5D";
  value:number|null;
  direction:WindowDirection;
  display:string;
  widthPercent:number;
  leftPercent:number;
};

export function projectWindowChangeLanes(
  values:{change:number|null;change3d:number|null;change5d:number|null},
  unit:WindowUnit,
):WindowLane[]{
  const points=[
    {name:"1D" as const,value:values.change},
    {name:"3D" as const,value:values.change3d},
    {name:"5D" as const,value:values.change5d},
  ];
  const finite=points.map(point=>point.value)
    .filter((value):value is number=>value!==null&&Number.isFinite(value));
  const maximum=Math.max(0,...finite.map(Math.abs));
  return points.map(({name,value})=>{
    if(value===null||!Number.isFinite(value))return {
      name,value:null,direction:"unknown" as const,display:"—",widthPercent:0,leftPercent:50,
    };
    const direction:WindowDirection=value>0?"up":value<0?"down":"flat";
    // The midpoint is zero. Left means negative, right means positive.
    // Scale against this instrument's own three window measurements only.
    const widthPercent=maximum>0?49.5*Math.abs(value)/maximum:0;
    return {
      name,value,direction,
      display:`${value>0?"+":""}${value.toFixed(unit==="bp"?1:2)}${unit}`,
      widthPercent,leftPercent:value<0?50-widthPercent:50,
    };
  });
}
