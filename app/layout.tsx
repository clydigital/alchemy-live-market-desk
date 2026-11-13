import "./globals.css";
import "./bluebelly-tokens.css";
import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

// One self-hosted, build-time optimised font for public Bluebelly and owner tools.
const figtree = Figtree({ subsets: ["latin"], display: "swap", variable: "--font-figtree" });


// Restore persisted theme/rail state before the first painted frame. Applying
// these only in client effects causes a yellow template flash on navigation.
const BLUEBELLY_EARLY_PREFERENCES = `(function(){
 try {
  var root=document.documentElement;
  var theme=window.localStorage.getItem("bluebelly-theme");
  if (theme==="yellow-black"||theme==="turquoise"||theme==="neon-blue"||theme==="pastel-green") {
   root.setAttribute("data-bluebelly-theme",theme);
  }
  if (window.localStorage.getItem("bluebelly:command-sidebar-shelved")==="1") {
   root.setAttribute("data-bluebelly-sidebar","shelved");
  }
 } catch(_) { /* Storage denied: render default without errors. */ }
})();`;

export const metadata: Metadata = {
  title: "Bluebelly | Market Intelligence Workspace",
  description: "An interactive market research workspace for stories, earnings intelligence, signals, charts and persistent research history.",
};

export const viewport: Viewport = {
  themeColor: "#11152f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB" className={figtree.variable} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:BLUEBELLY_EARLY_PREFERENCES}}/></head><body>{children}</body></html>;
}
