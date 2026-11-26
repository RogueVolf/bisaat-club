import type { SiteContent } from "./schema";

export const SEED: SiteContent = {
  settings: {
    openingAt: "2026-12-12T09:00:00+05:30",
    timezone: "Asia/Kolkata",
    hours: {
      opens: "09:00",
      closes: "23:00",
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    },
    hoursText: "9 AM to 11 PM",
    address: {
      line1: "5th Floor, Gold Mani Business Centre",
      street: "Coles Road",
      locality: "Frazer Town",
      city: "Bengaluru",
      region: "Karnataka",
      country: "IN",
    },
    shortAddress: "5th Floor, Gold Mani Business Centre",
    whatsapp: "+919945205694",
    instagram: "bisaatclub",
    bookingUrl: "https://wa.me/919945205694",
    bookingLabel: "Book on WhatsApp",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Gold+Mani+Business+Centre+Coles+Road+Frazer+Town+Bangalore",
  },
  zones: [
    {
      id: "door", order: 0, spotLabel: null,
      kicker: "A third space in Frazer Town", title: "Play. Read. Stay.",
      body: "PS5, sim racing, board games and a free library on one floor. Open 9 AM to 11 PM. One rule: no laptops.",
      price: "",
      cam: [3.45, 4.95], yaw: 30, pitch: -5, at: null,
    },
    {
      id: "ps5", order: 1, spotLabel: "PS5 corner",
      kicker: "Along the left wall", title: "PS5 corner",
      body: "Bean bags at one screen, a sofa at the other. Up to four players each. EA FC 27, GTA 6, Tekken 8 and more.",
      price: "₹300 an hour on weekdays, ₹500 on weekends",
      cam: [4.1, 2.55], yaw: -90, pitch: -12, at: [1.5, 1.0, 2.5],
    },
    {
      id: "race", order: 2, spotLabel: "Sim rigs",
      kicker: "Against the far wall", title: "Sim racing",
      body: "Two F1-style cockpits, one PS5, one Xbox. Gran Turismo 7 and F1 25.",
      price: "₹400 to ₹650 an hour",
      cam: [4.35, 4.5], yaw: 0, pitch: -8, at: [4.3, 1.3, 1.2],
    },
    {
      id: "games", order: 3, spotLabel: "Board games",
      kicker: "In the middle of the room", title: "Board games and chai",
      body: "The chill zone. Pick a table, open a box, lose track of the afternoon.",
      price: "₹500 for 30 days. Free if you book gaming.",
      cam: [4.5, 4.3], yaw: 62, pitch: -12, at: [6.9, 1.0, 2.9],
    },
    {
      id: "lib", order: 4, spotLabel: "Reading room",
      kicker: "By the long windows", title: "Reading room",
      body: "A bookshelf at each end and reading lamps on the tables. 500+ books, run by Safar-e-Siyahi. Borrow one or read it here.",
      price: "Always free",
      cam: [7.7, 3.7], yaw: 52, pitch: -7, at: [9.8, 1.2, 2.7],
    },
    {
      id: "desk", order: 5, spotLabel: "Reception",
      kicker: "Reception, by the door", title: "Start here.",
      body: "Walk up, pick a zone, stay as long as you like. Or book ahead on WhatsApp.",
      price: "",
      cam: [5.9, 2.1], yaw: 179, pitch: 0, at: [5.95, 1.3, 4.7],
    },
  ],
  prices: [
    { id: "ps5-couch", item: "PS5 couch station, up to 4 players", weekdayRate: 300, weekendRate: 500, unit: "hour", note: "", order: 0 },
    { id: "ps5-sim", item: "PS5 sim rig", weekdayRate: 500, weekendRate: 650, unit: "hour", note: "", order: 1 },
    { id: "xbox-sim", item: "Xbox sim rig", weekdayRate: 400, weekendRate: 550, unit: "hour", note: "", order: 2 },
    { id: "chill-pass", item: "Chill zone pass", weekdayRate: 500, weekendRate: 500, unit: "30 days", note: "Free for anyone who books gaming", order: 3 },
    { id: "student-hour", item: "Student hour", weekdayRate: null, weekendRate: null, unit: "session", note: "30% off, weekdays 11 AM to 4 PM", order: 4 },
    { id: "library", item: "Library", weekdayRate: null, weekendRate: null, unit: "free", note: "Always free; 500+ books, run by Safar-e-Siyahi (safaresiyahi.in)", order: 5 },
  ],
};
