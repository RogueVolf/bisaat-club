import { headers } from "next/headers";
import { Stage } from "@/components/Stage";
import { localBusinessJsonLd, serializeJsonLd } from "@/content/structured-data";
import { siteUrl } from "@/server/site-url";
import { getSiteContent } from "@/server/content/repository";

export default async function Home() {
  const [{ content }, h, base] = await Promise.all([getSiteContent(), headers(), siteUrl()]);
  const nonce = h.get("x-nonce") ?? undefined;
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(localBusinessJsonLd(content.settings, base.origin)) }}
      />
      <Stage content={content} />
    </>
  );
}
