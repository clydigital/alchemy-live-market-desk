const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.PREVIEW_URL;
if (!root) throw Error("Explicit preview URL required");
const directory = "test-results/presenter-prep-preview";
fs.mkdirSync(directory, { recursive: true });
const historical = "77bed182-0da4-40e6-9a69-f37755a854c8";
const rich = "2768647d-546f-4e31-9ac4-256de0cba6ac";
const motion = "2ec14b25-82c6-4afe-9822-c6d68fb3764a";
const goodFocus = "edition=" + rich + "&story=market-breadth-health&motion=" + motion
  + "&regime=energy-security-inflation";
async function run() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const scenarios = [
      ["invalid-edition", "?edition=does-not-exist-safety-test"],
      ["historical-edition", "?edition=" + historical],
      ["valid-cross-focus", "?" + goodFocus],
      ["mismatched-cross-focus", "?edition=" + rich + "&story=ai-financing-stress&motion=" + motion + "&regime=energy-security-inflation"],
      ["late-story-focus", "?edition=" + rich + "&story=global-credit-transmission"],
    ];
    for (const [name, query] of scenarios) {
      const url = new URL("/hybrid-output/prepare" + query, root);
      const response = await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1800);
      const body = await page.locator("body").innerText().catch(() => "");
      await page.screenshot({ path: path.join(directory, name + ".png"), fullPage: true });
      const info = {name, status: response?.status(), ready: /READY/.test(body), unavailable: /UNAVAILABLE|Exact source unavailable|INVALID_EDITION/.test(body), reason: /FOCUS_RELATIONSHIP_MISMATCH|INVALID_EDITION/.exec(body)?.[0] ?? null, focusedStory: body.includes("FOCUSED STORY"), focusedMotion: body.includes("FOCUSED MOTION"), frozenState: body.includes("FROZEN STORY STATE")};
      console.log(JSON.stringify(info));
      if (!body.includes("Presenter Prep") || !response || response.status() !== 200) throw Error(name + " preview UI unavailable");
      if (name === "invalid-edition" && (!info.unavailable || !body.includes("INVALID_EDITION"))) throw Error("Invalid edition did not fail closed");
      if (name === "mismatched-cross-focus" && (!info.unavailable || !body.includes("FOCUS_RELATIONSHIP_MISMATCH"))) throw Error("Cross-focus mismatch not blocked");
      if (["historical-edition","valid-cross-focus","late-story-focus"].includes(name) && !info.ready) throw Error(name + " did not render an exact pinned edition");
      if (name === "historical-edition") {
        const href = await page.getByRole("link", {name:/Open this edition in Hybrid Journey/}).first().getAttribute("href");
        if (!href?.includes("edition=" + historical)) throw Error("Historical return link lost edition identity");
      }
      if (name === "valid-cross-focus" && !(info.focusedStory && info.focusedMotion && info.frozenState)) throw Error("Matched frozen focus not prioritised or labelled");
      if (name === "late-story-focus" && (!info.focusedStory || info.focusedMotion)) throw Error("Late Story incorrectly hidden or unrelated Motion marked focused");
    }
    const journey = await page.goto(new URL("/hybrid-output?" + goodFocus, root).toString(), {waitUntil:"domcontentloaded",timeout:45000});
    if (!journey || journey.status() !== 200) throw Error("Historical Journey could not be opened");
    const nav = page.getByRole("link", {name:"Presenter Prep"});
    await nav.waitFor({state:"visible",timeout:20000});
    const href = await nav.getAttribute("href");
    console.log("Journey-to-Prep preserved: " + href);
    for (const keyValue of goodFocus.split("&")) if (!href?.includes(keyValue)) throw Error("Journey navigation lost " + keyValue);
    await page.screenshot({path:path.join(directory,"journey-navigation.png"),fullPage:false});
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
