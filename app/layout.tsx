import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alchemy Live Market Desk",
  description: "Persistent market intelligence, story ranking and earnings transcript analysis for Alchemy Markets.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
