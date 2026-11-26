import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Stage } from "@/components/Stage";
import { SEED } from "@/content/seed";

const html = (content = SEED) => renderToStaticMarkup(<Stage content={content} />);
const tag = (h: string, id: string) => h.match(new RegExp(`<(a|button|h1|div|p)[^>]*id="${id}"[^>]*>[^]*?</\\1>`))![0];

describe("page shell", () => {
  it("shows the door zone in the sheet", () => {
    expect(tag(html(), "title")).toContain("Play. Read. Stay.");
  });
  it("renders book and find from settings", () => {
    const h = html();
    const book = tag(h, "book");
    expect(book).toContain('href="https://wa.me/919945205694"');
    expect(book).toContain("Book on WhatsApp");
    expect(book).toContain('target="_blank"');
    expect(book).toContain('rel="noopener"');
    const find = tag(h, "find");
    expect(find).toContain("Find us · 5th Floor, Gold Mani Business Centre");
    expect(find).toContain(`href="${SEED.settings.mapsUrl.replace(/&/g, "&amp;")}"`);
  });
  it("renders five spots in order", () => {
    const labels = [...html().matchAll(/<button class="spot" data-go="[^"]+"><i><\/i><span>([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(labels).toEqual(["PS5 corner", "Sim rigs", "Board games", "Reading room", "Reception"]);
  });
  it("booking link is data driven", () => {
    const h = html({ ...SEED, settings: { ...SEED.settings, bookingUrl: "/book", bookingLabel: "Book now" } });
    const book = tag(h, "book");
    expect(book).toContain('href="/book"');
    expect(book).toContain("Book now");
  });
  it("renders header and DOM contract", () => {
    const h = html();
    expect(h).toContain('src="/brand/logo.png"');
    expect(h).toContain("Opens Sat 12 Dec");
    expect(h).toContain('<span id="count"></span>');
    for (const id of ["stage", "top", "brand", "right", "open", "mode", "sun", "moon", "view", "gl", "nogl", "hint", "sheet", "copy", "kicker", "rule", "body", "price", "actions", "next"])
      expect(h).toContain(`id="${id}"`);
    expect(h).toContain('aria-live="polite"');
  });
});
