"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Client-visible revalidation only. The authenticated Live research slot
 * remains the sole macro time-series writer; no browser-side BLS requests. */
export default function AutoRefreshMacroData() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = globalThis.setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      globalThis.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);
  return null;
}
