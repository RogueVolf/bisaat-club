import type { Settings } from "./schema";

export function localBusinessJsonLd(settings: Settings, siteUrl: string): object {
  const a = settings.address;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Bisaat Club",
    url: siteUrl,
    telephone: settings.whatsapp,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${a.line1}, ${a.street}`,
      addressLocality: a.city,
      addressRegion: a.region,
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
      addressCountry: a.country,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: settings.hours.days,
      opens: settings.hours.opens,
      closes: settings.hours.closes,
    },
    sameAs: [`https://www.instagram.com/${settings.instagram}`],
  };
}

/** JSON for an inline <script>: `<` is escaped so content can never close the tag. */
export function serializeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
