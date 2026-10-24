import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Alchemy Live Desk | Market Intelligence Workspace",
  description: "An interactive market research workspace for stories, earnings intelligence, signals, charts and persistent research history.",
};

export const viewport: Viewport = {
  themeColor: "#11152f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&display=swap" /></head><body>{children}</body></html>;
}
