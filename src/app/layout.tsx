import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bisaat Club",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
