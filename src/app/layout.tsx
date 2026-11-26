import type { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Bisaat Club",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts the tree into dynamic rendering, which is what lets
  // Next apply the per-request CSP nonce (set by src/proxy.ts) to its own scripts.
  // Task 8 passes this nonce to the JSON-LD <script>.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  void nonce;
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
