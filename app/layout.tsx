import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Alchemy Live Desk | Market Intelligence",
  description: "Persistent market questions, earnings intelligence, chart requests and research history for Alchemy Markets.",
};

export const viewport: Viewport = {
  themeColor: "#10142b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
