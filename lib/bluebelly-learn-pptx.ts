/**
 * Original, author-supplied Bluebelly Learn PowerPoints.
 *
 * These files are NOT generated from the accessible web-text editions.
 * Put the unchanged original binaries at public/bluebelly/learn/original/.
 * GitHub raw URLs are public and stable after this branch lands on main.
 */
export const BLUEBELLY_ORIGINAL_PPTX = {
  D02: "D02_Treasury_Yields_and_the_Fed_v1.pptx",
  D06: "D06_Crude_Diesel_Refining_Cracks_v1.pptx",
  D08: "D08_Who_Makes_Money_From_AI_v1.pptx",
  D13: "D13_Bonds_How_They_Work_v1.pptx",
  D15: "D15_Reading_CPI_GDP_Jobs_v1.pptx",
  D17: "D17_DXY_JXY_USDJPY_Oil_v1.pptx",
  D23: "D23_Position_Sizing_and_Portfolio_Heat_v1.pptx",
  D24: "D24_Prop_Challenge_Drawdown_Game_v1.pptx",
  D26: "D26_Bollinger_vs_EMA_1SD_Breakout_v1.pptx",
} as const;

export type BluebellyOriginalDeckId = keyof typeof BLUEBELLY_ORIGINAL_PPTX;

const ORIGINAL_REPO_ROOT =
  "https://raw.githubusercontent.com/clydigital/alchemy-live-market-desk/main/public/bluebelly/learn/original/";

export function getOriginalLearnPptx(deckId: string) {
  const key = deckId.toUpperCase() as BluebellyOriginalDeckId;
  const filename = BLUEBELLY_ORIGINAL_PPTX[key];
  if (!filename) return null;
  const sourceUrl = ORIGINAL_REPO_ROOT + encodeURIComponent(filename);
  return {
    filename,
    sourceUrl,
    viewerUrl: "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(sourceUrl),
    fullScreenUrl: "https://view.officeapps.live.com/op/view.aspx?src=" + encodeURIComponent(sourceUrl),
  };
}
