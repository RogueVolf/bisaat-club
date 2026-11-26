import { headers } from "next/headers";
import { Stage } from "@/components/Stage";
import { localBusinessJsonLd, serializeJsonLd } from "@/content/structured-data";
import { getSiteContent } from "@/server/content/repository";

export default async function Home() {
  const [{ content }, h] = await Promise.all([getSiteContent(), headers()]);
  const nonce = h.get("x-nonce") ?? undefined;
  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(localBusinessJsonLd(content.settings, siteUrl)) }}
      />
      <Stage content={content} />
    </>
  );
}
