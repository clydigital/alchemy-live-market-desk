"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  title: string;
  imageUrl: string | null;
  fallbackImageUrl: string;
  imageKind?: "research" | "fallback" | null;
  publisher?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  className: string;
};

export default function StoryHeaderImage({
  title,
  imageUrl,
  fallbackImageUrl,
  imageKind,
  publisher,
  sourceUrl,
  sourceTitle,
  className,
}: Props) {
  const researchUrl = useMemo(() => {
    if (!imageUrl || imageKind !== "research" || imageUrl === fallbackImageUrl) return null;
    return imageUrl;
  }, [fallbackImageUrl, imageKind, imageUrl]);

  // Render the local ZIP artwork first. A remote research image only replaces it
  // after the browser has proved that the URL can actually be displayed.
  const [src, setSrc] = useState(fallbackImageUrl);
  const [usingFallback, setUsingFallback] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setSrc(fallbackImageUrl);
    setUsingFallback(true);

    if (!researchUrl) return () => { cancelled = true; };

    const candidate = new Image();
    candidate.referrerPolicy = "no-referrer";
    candidate.onload = () => {
      if (cancelled) return;
      setSrc(researchUrl);
      setUsingFallback(false);
    };
    candidate.onerror = () => {
      if (cancelled) return;
      setSrc(fallbackImageUrl);
      setUsingFallback(true);
    };
    candidate.src = researchUrl;

    return () => {
      cancelled = true;
      candidate.onload = null;
      candidate.onerror = null;
    };
  }, [fallbackImageUrl, researchUrl, title]);

  function useFallback() {
    setSrc(fallbackImageUrl);
    setUsingFallback(true);
  }

  return (
    <figure className={className} data-image-kind={usingFallback ? "fallback" : "research"}>
      <img
        src={src}
        alt={`Market illustration for ${title}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={useFallback}
      />
      <figcaption>
        <span>{usingFallback ? "Alchemy fallback artwork" : publisher || "Research image"}</span>
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noreferrer" title={sourceTitle || undefined}>
            Open article ↗
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
