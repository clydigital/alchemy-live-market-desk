"use client";

import { useEffect, useState } from "react";
import type { LearnSlide } from "@/lib/bluebelly-learn-decks";
import ui from "@/app/blue-desk/learn/learn.module.css";

export default function LearnSlideReader({ slides, deckId }: {
  slides: LearnSlide[];
  deckId: string;
}) {
  const [current, setCurrent] = useState(0);
  const [readAll, setReadAll] = useState(false);
  useEffect(() => {
    if (readAll) return;
    function handleKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const element = event.target as HTMLElement | null;
      if (element && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(element.tagName)) return;
      if (event.key === "ArrowRight") setCurrent((page) => Math.min(page + 1, slides.length - 1));
      if (event.key === "ArrowLeft") setCurrent((page) => Math.max(page - 1, 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [readAll, slides.length]);

  const active = slides[current];
  function slideCard(slide: LearnSlide) {
    return <article key={slide.number} className={ui.lessonSlide} data-slide-design="cyberpunk-presentation" aria-label={"Slide " + slide.number + " of " + slides.length}>
      <div className={ui.slideTopRail}>
        <span>BLUEBELLY / PRESENTATION FILE {deckId}</span>
        <span>MODULE {slide.section.toUpperCase()}</span>
        <span>FRAME {String(slide.number).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
      </div>
      <div className={ui.slideStage}>
        <div className={ui.slideMain}>
          <div className={ui.slideMeta}>
            <span>LESSON {deckId} / {slide.section}</span>
            <span>ORIGINAL EDUCATIONAL EDITION</span>
          </div>
          <h2>{slide.title}</h2>
          <div className={ui.slideAccentRule} aria-hidden="true"><span /></div>
          <div className={ui.slideLines}>
            {slide.lines.map((line, index) =>
              <p key={index} className={line.length < 45 ? ui.slideShort : ui.slideLong}>
                <span className={ui.slideLineIndex} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </p>)}
          </div>
        </div>
        <aside className={ui.slideVisualRail} aria-hidden="true">
          <span className={ui.slideVisualLabel}>// KNOWLEDGE SYSTEM</span>
          <div className={ui.slideReticle}>
            <span className={ui.slideReticleCore}>{deckId}</span>
          </div>
          <strong>{String(slide.number).padStart(2, "0")}</strong>
          <small>READ / CONNECT / VERIFY</small>
        </aside>
      </div>
      <footer><span>BLUEBELLY LEARN / EDUCATIONAL, NOT LIVE MARKET DATA</span><span>© PRESENTATION READER / {deckId}</span></footer>
    </article>;
  }
  return <section className={ui.reader} aria-label="Presentation reader">
    <div className={ui.readerBar}>
      <strong>{readAll ? "FIELD MANUAL / ALL FRAMES" : "PRESENTATION FILE " + deckId + " / FRAME " + (current + 1) + " OF " + slides.length}</strong>
      <button type="button" aria-pressed={readAll} onClick={() => setReadAll((value) => !value)}>
        {readAll ? "Single-slide view" : "Read all slides"}
      </button>
    </div>
    {readAll ?
      <div className={ui.readAll}>{slides.map(slideCard)}</div> :
      <>
        {slideCard(active)}
        <div className={ui.readerNav}>
          <button type="button" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))}>Previous</button>
          <label htmlFor="bluebelly-slide-picker">Slide</label>
          <select id="bluebelly-slide-picker" value={current} onChange={(event) => setCurrent(Number(event.target.value))}>
            {slides.map((slide, index) => <option value={index} key={slide.number}>{slide.number}. {slide.title}</option>)}
          </select>
          <button type="button" disabled={current === slides.length - 1} onClick={() => setCurrent((value) => Math.min(slides.length - 1, value + 1))}>Next</button>
        </div>
        <div role="progressbar" aria-label="Slides completed" aria-valuemin={1} aria-valuemax={slides.length}
          aria-valuenow={current + 1} className={ui.progress} >
          <span style={{ width: String(((current + 1) / slides.length) * 100) + "%" }} />
        </div>
      </>
    }
    <p className={ui.readerDisclaimer}>Accessible web-text edition derived from the original Bluebelly PowerPoint slides. Diagrams and exact slide layouts are not included in this edition. Slide figures are teaching illustrations, not current quotes. Use the official sources below for data and definitions.</p>
  </section>;
}
