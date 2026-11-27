import { describe, expect, it } from "vitest";
import { localBusinessJsonLd, serializeJsonLd } from "@/content/structured-data";
import { SEED } from "@/content/seed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ld = localBusinessJsonLd(SEED.settings, "https://bisaat.club") as Record<string, any>;

describe("localBusinessJsonLd", () => {
  it("describes the business", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("LocalBusiness");
    expect(ld.name).toBe("Bisaat Club");
    expect(ld.url).toBe("https://bisaat.club");
    expect(ld.telephone).toBe("+919945205694");
    expect(ld.sameAs).toContain("https://www.instagram.com/bisaatclub");
  });
  it("has a postal address", () => {
    expect(ld.address["@type"]).toBe("PostalAddress");
    expect(ld.address.streetAddress).toContain("Gold Mani Business Centre");
    expect(ld.address.streetAddress).toContain("Coles Road");
    expect(ld.address.addressLocality).toBe("Bengaluru");
    expect(ld.address.addressCountry).toBe("IN");
    expect(ld.address.postalCode).toBe("560005");
  });
  it("has opening hours for seven days", () => {
    const spec = ld.openingHoursSpecification;
    expect(spec.opens).toBe("09:00");
    expect(spec.closes).toBe("23:00");
    expect(spec.dayOfWeek).toHaveLength(7);
  });
  it("escapes < when serialised", () => {
    const s = serializeJsonLd({ a: "</script><b>" });
    expect(s).not.toContain("<");
    expect(s).toContain("\\u003c/script>");
    expect(JSON.parse(s).a).toBe("</script><b>");
  });
});
