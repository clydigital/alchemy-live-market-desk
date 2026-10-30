# Bluebelly Learn — unchanged original PowerPoint hosting

The nine Learn lesson routes use the author-supplied ORIGINAL PowerPoint files. Do not regenerate the slides from web text, JSON, PDFs, screenshots, or a theme template.

## Exact source files and target location

Upload each original PPTX (unchanged bytes) to `public/bluebelly/learn/original/` in the repository:

- D02_Treasury_Yields_and_the_Fed_v1.pptx
- D06_Crude_Diesel_Refining_Cracks_v1.pptx
- D08_Who_Makes_Money_From_AI_v1.pptx
- D13_Bonds_How_They_Work_v1.pptx
- D15_Reading_CPI_GDP_Jobs_v1.pptx
- D17_DXY_JXY_USDJPY_Oil_v1.pptx
- D23_Position_Sizing_and_Portfolio_Heat_v1.pptx
- D24_Prop_Challenge_Drawdown_Game_v1.pptx
- D26_Bollinger_vs_EMA_1SD_Breakout_v1.pptx

These originals exist in the user's ChatGPT Live Desk Library, but the file service currently has not exposed raw bytes to this repository-editing session. **This branch must remain draft / unmerged until all nine actual binaries are uploaded and verified.** An accessible transcription is *not* an acceptable substitute.

After uploading, validate:
1. Nine files are Git-tracked and each is a legitimate `.pptx` ZIP package with PowerPoint parts. Record sizes and SHA-256 fingerprints.
2. Public raw.githubusercontent.com URL for each file returns an original PPTX with HTTP 200.
3. The Microsoft Office viewer iframe loads each original in a browser. Office viewer is a third-party service and needs an internet-accessible URL.
4. The original download link works independently of iframe.
5. /learn, all nine /learn/decks/dxx routes, glossary links, all theme modes, desktop/mobile, and private route blocks still pass.
6. Run TypeScript, tests and production build. Merge only after preview verification, then check live Vercel URL.

No backend, ingestion, schedules, auth, data, or historical edition changes. Keep original lesson metadata and underlying educational source links. Remove reconstructed slides **from the rendered page**; retain source JSON only as archival teaching text until separately reviewed for safe removal.

Never claim the original slide files are live before all assets are actually verified.
