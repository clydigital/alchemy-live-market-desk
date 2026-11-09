"use client";

import {useEffect,useState} from "react";
import chrome from "./bluebelly-chrome.module.css";

const STORAGE_KEY="bluebelly:command-sidebar-shelved";

/** Shared navigation control. It lives outside the moving rail so its handle
 * remains accessible when the rail is offscreen, on every Bluebelly page. */
export default function CommandSidebarToggle(){
  const [shelved,setShelved]=useState(false);
  const [restored,setRestored]=useState(false);

  useEffect(()=>{
    try{setShelved(window.localStorage.getItem(STORAGE_KEY)==="1");}
    catch{/* Navigation must still work when local storage is blocked. */}
    setRestored(true);
  },[]);

  useEffect(()=>{
    if(!restored)return;
    const root=document.documentElement;
    const nav=document.getElementById("bluebelly-command-navigation");
    if(shelved){
      root.setAttribute("data-bluebelly-sidebar","shelved");
      nav?.setAttribute("inert","");
      nav?.setAttribute("aria-hidden","true");
    }else{
      root.removeAttribute("data-bluebelly-sidebar");
      nav?.removeAttribute("inert");
      nav?.removeAttribute("aria-hidden");
    }
    try{window.localStorage.setItem(STORAGE_KEY,shelved?"1":"0");}
    catch{/* Still usable without persistence. */}

    return ()=>{
      root.removeAttribute("data-bluebelly-sidebar");
      nav?.removeAttribute("inert");
      nav?.removeAttribute("aria-hidden");
    };
  },[restored,shelved]);

  const label=shelved?"Show navigation sidebar":"Hide navigation sidebar";
  return <button
    type="button"
    className={chrome.sidebarToggle}
    data-shelved={shelved?"true":"false"}
    aria-controls="bluebelly-command-navigation"
    aria-expanded={!shelved}
    aria-label={label}
    title={label}
    onClick={()=>setShelved(value=>!value)}>
    <span aria-hidden="true" className={chrome.toggleArrow}>{shelved?"›":"‹"}</span>
    <span aria-hidden="true" className={chrome.toggleLabel}>NAV</span>
  </button>;
}
