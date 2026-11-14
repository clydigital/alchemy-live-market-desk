"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";

// Re-read existing source-dated server projections while a viewer keeps this
// dashboard open. This is not an ingestion job or a real-time price stream.
export default function CrashEvidenceAutoRefresh(){
 const router=useRouter();
 useEffect(()=>{
  const interval=window.setInterval(()=>{
   if(document.visibilityState==="visible")router.refresh();
  },10*60*1000);
  return ()=>window.clearInterval(interval);
 },[router]);
 return null;
}
