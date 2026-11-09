"use client";

import {useEffect,useRef} from "react";
import styles from "./CommandPointerHalo.module.css";

/**
 * A visual-only ambient pointer spotlight for the shared v7 shell.
 * No pointer coordinates leave the browser, no app state is changed, and no
 * content or interactive surface is replaced by a canvas.
 */
export default function CommandPointerHalo(){
  const ref=useRef<HTMLDivElement|null>(null);

  useEffect(()=>{
    const node=ref.current;
    if(!node)return;

    const fine=window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0;
    let hasPosition=false;
    let x=0,y=0,targetX=0,targetY=0;

    const enabled=()=>fine.matches&&!reduced.matches;
    const hide=()=>{node.dataset.visible="false";};

    const render=()=>{
      frame=0;
      x+=(targetX-x)*0.26;
      y+=(targetY-y)*0.26;
      node.style.setProperty("--halo-x",x.toFixed(1)+"px");
      node.style.setProperty("--halo-y",y.toFixed(1)+"px");
      if(Math.abs(targetX-x)>0.5||Math.abs(targetY-y)>0.5)
        frame=window.requestAnimationFrame(render);
    };
    const move=(event:PointerEvent)=>{
      if(event.pointerType==="touch"||!enabled())return;
      targetX=event.clientX;targetY=event.clientY;
      if(!hasPosition){
        x=targetX;y=targetY;hasPosition=true;
        node.style.setProperty("--halo-x",x+"px");
        node.style.setProperty("--halo-y",y+"px");
      }
      node.dataset.visible="true";
      if(!frame)frame=window.requestAnimationFrame(render);
    };
    const leave=(event:PointerEvent)=>{
      if(!event.relatedTarget)hide();
    };
    const modeChange=()=>{if(!enabled())hide();};
    const visibility=()=>{if(document.hidden)hide();};

    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerout",leave,{passive:true});
    window.addEventListener("blur",hide);
    document.addEventListener("visibilitychange",visibility);
    fine.addEventListener("change",modeChange);
    reduced.addEventListener("change",modeChange);
    return ()=>{
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerout",leave);
      window.removeEventListener("blur",hide);
      document.removeEventListener("visibilitychange",visibility);
      fine.removeEventListener("change",modeChange);
      reduced.removeEventListener("change",modeChange);
      if(frame)window.cancelAnimationFrame(frame);
    };
  },[]);

  return <div ref={ref} className={styles.halo} aria-hidden="true"
    data-bluebelly-pointer-halo="presentation-only" data-visible="false"/>;
}
