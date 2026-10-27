import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

// One self-hosted, build-time optimised font for public Bluebelly and owner tools.
const figtree = Figtree({ subsets: ["latin"], display: "swap", variable: "--font-figtree" });

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
  return <html lang="en-GB" className={figtree.variable}><body>{children}</body></html>;
}
