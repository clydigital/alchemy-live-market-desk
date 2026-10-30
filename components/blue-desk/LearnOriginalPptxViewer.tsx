import { getOriginalLearnPptx } from "@/lib/bluebelly-learn-pptx";
import ui from "./LearnOriginalPptxViewer.module.css";

/** The iframe displays the unchanged original PPTX through Microsoft's online viewer. */
export default function LearnOriginalPptxViewer({
  deckId,
  title,
}: {
  deckId: string;
  title: string;
}) {
  const deck = getOriginalLearnPptx(deckId);
  if (!deck) return null;

  return (
    <section className={ui.viewer} aria-label={"Original PowerPoint presentation: " + title}>
      <div className={ui.toolbar}>
        <div>
          <span className={ui.overline}>ORIGINAL POWERPOINT / {deckId}</span>
          <h2>View the actual slide deck</h2>
          <p>The original PowerPoint is displayed unchanged. No reconstructed HTML slides.</p>
        </div>
        <div className={ui.actions}>
          <a href={deck.fullScreenUrl} target="_blank" rel="noopener noreferrer">Open full-screen viewer</a>
          <a href={deck.sourceUrl} target="_blank" rel="noopener noreferrer">Original PPTX</a>
        </div>
      </div>
      <div className={ui.frameWrap}>
        <iframe
          className={ui.frame}
          title={title + " — original PowerPoint"}
          src={deck.viewerUrl}
          loading="lazy"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className={ui.note}>
        Embedded presentation is served by Microsoft Office from the public GitHub-hosted original.
        If the frame is blocked by your browser or network, use the original PPTX link above.
        This is educational material, not current market data or a trade instruction.
      </p>
    </section>
  );
}
