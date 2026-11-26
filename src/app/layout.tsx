import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bisaat Club",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1F2A44",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts the tree into dynamic rendering, which is what lets
  // Next apply the per-request CSP nonce (set by src/proxy.ts) to its own scripts.
  // Task 8 passes this nonce to the JSON-LD <script>.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  void nonce;
  return (
    <html lang="en" data-mode="day" className={dmSans.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
