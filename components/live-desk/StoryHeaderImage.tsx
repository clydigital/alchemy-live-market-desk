"use client";

import { useEffect, useState } from "react";

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
  const preferredUrl = imageUrl || fallbackImageUrl;
  const [src, setSrc] = useState(preferredUrl);
  const [usingFallback, setUsingFallback] = useState(!imageUrl || imageKind === "fallback");

  useEffect(() => {
    setSrc(preferredUrl);
    setUsingFallback(!imageUrl || imageKind === "fallback");
  }, [fallbackImageUrl, imageKind, imageUrl, preferredUrl, title]);

  function useFallback() {
    if (src !== fallbackImageUrl) {
      setSrc(fallbackImageUrl);
      setUsingFallback(true);
    }
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
