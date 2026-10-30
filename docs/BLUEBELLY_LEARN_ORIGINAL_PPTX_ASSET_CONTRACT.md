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

These nine original PPTX binaries were copied from the user's Library into a temporary private Drive staging folder, then uploaded **without reconstruction** to GitHub. All nine are now Git-tracked in this branch, with valid PowerPoint ZIP internals and exactly 152 total slides. Git blob SHA hashes match local original byte hashes.

**Before merging**, GitHub CI must pass; verify the Office viewer renders the original slides (rather than only showing an HTTP 200 page), downloads work, and the public/protected route matrix remains intact.

After uploading, validate:
1. Nine files are Git-tracked and each is a legitimate `.pptx` ZIP package with PowerPoint parts. Record sizes and SHA-256 fingerprints.
2. Public raw.githubusercontent.com URL for each file returns an original PPTX with HTTP 200.
3. The Microsoft Office viewer iframe loads each original in a browser. Office viewer is a third-party service and needs an internet-accessible URL.
4. The original download link works independently of iframe.
5. /learn, all nine /learn/decks/dxx routes, glossary links, all theme modes, desktop/mobile, and private route blocks still pass.
6. Run TypeScript, tests and production build. Merge only after preview verification, then check live Vercel URL.

No backend, ingestion, schedules, auth, data, or historical edition changes. Keep original lesson metadata and underlying educational source links. Remove reconstructed slides **from the rendered page**; retain source JSON only as archival teaching text until separately reviewed for safe removal.

Never claim the original slide files are live before all assets are actually verified.

## Verified SHA-256 fingerprints of original bytes

```text
D02 d3ac91bca0f517935609ca863edc45883b1e9700af21ab84ef58f7460c7b938d
D06 d3bcddb033e9cdb04d37bf5c1833712b8bbba4bd401d86b1ce0bcfaca812c296
D08 1dc5be9c4e1bc708126ffe4d76cee78e3a9a40faa47fcd91858111f9cad94040
D13 79949ff0b795bb1c3b41d014e4a62844936f41ccb697f0cf078f4dcd36196f94
D15 b8f3ed41696afa4fcb02d8baf6ec5e4f0806341177f406edd1838bdadec562b3
D17 0f12e93a32393b312d949fe41eb45fff9d68ea48ada792e128feae055a54a709
D23 99f11a5199f1fef097553dddf96cf935e5ae61e2e34bd29d8d0b7f66579393cb
D24 1cedd9c68728dfec67949d61c9ab8006f650e16014f05c6e8f970d8fb9be0fca
D26 58311d2e3740355f146c6c2cb5f6813a1aa2e7a3aa6bdf2b6533c9a7dc16283d
```
