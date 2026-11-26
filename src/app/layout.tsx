import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { headers } from "next/headers";
import { siteUrl } from "@/server/site-url";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

const DESCRIPTION =
  "PS5, sim racing, board games and a free library on one floor in Frazer Town, Bangalore. Open 9 AM to 11 PM. One rule: no laptops.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "Bisaat Club — Walk the floor",
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Bisaat Club",
    locale: "en_IN",
    title: "Bisaat Club — Walk the floor",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
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
  // The page reads the same nonce for its JSON-LD <script>.
  await headers();
  return (
    <html lang="en" data-mode="day" className={dmSans.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
