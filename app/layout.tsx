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
  return <html lang="en"><body>{children}</body></html>;
}
