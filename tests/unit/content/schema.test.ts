import { describe, expect, it } from "vitest";
import { SiteContentSchema, ZoneSchema, SettingsSchema } from "@/content/schema";
import { SEED } from "@/content/seed";

const REF_ZONES = {
  door: { kicker: 'A third space in Frazer Town', title: 'Play. Read. Stay.',
    body: 'PS5, sim racing, board games and a free library on one floor. Open 9 AM to 11 PM. One rule: no laptops.', price: '',
    cam: [3.45, 4.95], yaw: 30, pitch: -5, at: null },
  ps5: { kicker: 'Along the left wall', title: 'PS5 corner',
    body: 'Bean bags at one screen, a sofa at the other. Up to four players each. EA FC 27, GTA 6, Tekken 8 and more.', price: '₹300 an hour on weekdays, ₹500 on weekends',
    cam: [4.1, 2.55], yaw: -90, pitch: -12, at: [1.5, 1.0, 2.5] },
  race: { kicker: 'Against the far wall', title: 'Sim racing',
    body: 'Two F1-style cockpits, one PS5, one Xbox. Gran Turismo 7 and F1 25.', price: '₹400 to ₹650 an hour',
    cam: [4.35, 4.5], yaw: 0, pitch: -8, at: [4.3, 1.3, 1.2] },
  games: { kicker: 'In the middle of the room', title: 'Board games and chai',
    body: 'The chill zone. Pick a table, open a box, lose track of the afternoon.', price: '₹500 for 30 days. Free if you book gaming.',
    cam: [4.5, 4.3], yaw: 62, pitch: -12, at: [6.9, 1.0, 2.9] },
  lib: { kicker: 'By the long windows', title: 'Reading room',
    body: 'A bookshelf at each end and reading lamps on the tables. 500+ books, run by Safar-e-Siyahi. Borrow one or read it here.', price: 'Always free',
    cam: [7.7, 3.7], yaw: 52, pitch: -7, at: [9.8, 1.2, 2.7] },
  desk: { kicker: 'Reception, by the door', title: 'Start here.',
    body: 'Walk up, pick a zone, stay as long as you like. Or book ahead on WhatsApp.', price: '',
    cam: [5.9, 2.1], yaw: 179, pitch: 0, at: [5.95, 1.3, 4.7] },
};
const REF_MAPS =
  "https://www.google.com/maps/search/?api=1&query=Gold+Mani+Business+Centre+Coles+Road+Frazer+Town+Bangalore";

describe("SEED", () => {
  it("parses and has ordered zone ids", () => {
    expect(() => SiteContentSchema.parse(SEED)).not.toThrow();
    expect(SEED.zones.map((z) => z.id)).toEqual(["door", "ps5", "race", "games", "lib", "desk"]);
    expect(SEED.zones.map((z) => z.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("zones match the reference", () => {
    for (const z of SEED.zones) {
      const ref = REF_ZONES[z.id as keyof typeof REF_ZONES];
      expect({
        kicker: z.kicker, title: z.title, body: z.body, price: z.price,
        cam: z.cam, yaw: z.yaw, pitch: z.pitch, at: z.at,
      }).toEqual(ref);
    }
  });

  it("spot labels", () => {
    expect(SEED.zones.map((z) => z.spotLabel)).toEqual([
      null, "PS5 corner", "Sim rigs", "Board games", "Reading room", "Reception",
    ]);
  });

  it("settings", () => {
    const s = SEED.settings;
    expect(s.openingAt).toBe("2026-12-12T09:00:00+05:30");
    expect(s.bookingUrl).toBe("https://wa.me/919945205694");
    expect(s.bookingLabel).toBe("Book on WhatsApp");
    expect(s.whatsapp).toBe("+919945205694");
    expect(s.instagram).toBe("bisaatclub");
    expect(s.hours.opens).toBe("09:00");
    expect(s.hours.closes).toBe("23:00");
    expect(s.hours.days).toHaveLength(7);
    expect(s.hoursText).toBe("9 AM to 11 PM");
    expect(s.shortAddress).toBe("5th Floor, Gold Mani Business Centre");
    expect(s.address.postalCode).toBe("560005");
    expect(s.openLabel).toBe("Open today");
    expect(s.mapsUrl).toBe(REF_MAPS);
  });

  it("price item names", () => {
    expect(SEED.prices.map((x) => x.item)).toEqual([
      "PS5 couch station, up to 4 players", "PS5 sim rig", "Xbox sim rig",
      "Chill-zone pass", "Student Hour", "Library",
    ]);
  });

  it("prices", () => {
    const p = Object.fromEntries(SEED.prices.map((x) => [x.id, x]));
    expect(p["ps5-couch"]).toMatchObject({ item: "PS5 couch station, up to 4 players", weekdayRate: 300, weekendRate: 500, unit: "hour" });
    expect(p["ps5-sim"]).toMatchObject({ weekdayRate: 500, weekendRate: 650, unit: "hour" });
    expect(p["xbox-sim"]).toMatchObject({ weekdayRate: 400, weekendRate: 550, unit: "hour" });
    expect(p["chill-pass"]).toMatchObject({ weekdayRate: 500, weekendRate: 500, unit: "30 days", note: "Free for anyone who books gaming" });
    expect(p["student-hour"]).toMatchObject({ weekdayRate: null, weekendRate: null, unit: "session", note: "30% off, weekdays 11 AM to 4 PM" });
    expect(p["library"]).toMatchObject({ weekdayRate: null, weekendRate: null, unit: "free", note: "Always free; 500+ books, run by Safar-e-Siyahi (safaresiyahi.in)" });
  });
});

describe("rejects", () => {
  it("unknown zone key", () => {
    expect(ZoneSchema.safeParse({ ...SEED.zones[0], extra: 1 }).success).toBe(false);
  });
  it("javascript: and http bookingUrl", () => {
    for (const bookingUrl of ["javascript:alert(1)", "http://x", "//evil.com", "/\\evil.com"]) {
      expect(SettingsSchema.safeParse({ ...SEED.settings, bookingUrl }).success).toBe(false);
    }
  });
  it("accepts a site path bookingUrl", () => {
    expect(SettingsSchema.safeParse({ ...SEED.settings, bookingUrl: "/book" }).success).toBe(true);
  });
  it("non-https mapsUrl", () => {
    expect(SettingsSchema.safeParse({ ...SEED.settings, mapsUrl: "http://maps.example" }).success).toBe(false);
  });
  it("zone id with a dash", () => {
    expect(ZoneSchema.safeParse({ ...SEED.zones[0], id: "lib-night" }).success).toBe(false);
  });
  it("duplicate zone ids", () => {
    expect(SiteContentSchema.safeParse({ ...SEED, zones: [SEED.zones[0], SEED.zones[0]] }).success).toBe(false);
  });
  it("duplicate price ids", () => {
    expect(SiteContentSchema.safeParse({ ...SEED, prices: [SEED.prices[0], SEED.prices[0]] }).success).toBe(false);
  });
});
