import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("leaves out a spot whose zone has a label but no position in the room", () => {
    const zones = SEED.zones.map((z) => (z.id === "race" ? { ...z, at: null } : z));
    const ids = [...html({ ...SEED, zones }).matchAll(/<button class="spot" data-go="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["ps5", "games", "lib", "desk"]);
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

describe("header after opening", () => {
  afterEach(() => vi.useRealTimers());
  it("shows the countdown before the opening time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-12T08:59:00+05:30"));
    const open = tag(html(), "open");
    expect(open).toContain("Opens Sat 12 Dec");
    expect(open).toContain('id="count"');
  });
  it("shows the open label and hours from settings, with no countdown", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-12-12T09:00:00+05:30"));
    const settings = { ...SEED.settings, openLabel: "Open now", hoursText: "10 AM to 10 PM" };
    const open = tag(html({ ...SEED, settings }), "open");
    expect(open).toContain("<b>Open now</b>");
    expect(open).toContain("10 AM to 10 PM");
    expect(open).not.toContain("Opens");
    expect(open).not.toContain('id="count"');
  });
});
