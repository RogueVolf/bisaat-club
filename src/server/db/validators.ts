// No `server-only` import: scripts/seed.ts uses this module.

export const COLLECTIONS = { settings: "settings", zones: "zones", prices: "prices" } as const;

const str = { bsonType: "string" };
const int = { bsonType: ["int", "long"] };
const num = { bsonType: ["int", "long", "double"] };
const nullableInt = { bsonType: ["int", "long", "null"] };

function strict(properties: Record<string, object>, required: string[]) {
  return {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", ...required],
      additionalProperties: false,
      properties: { _id: str, ...properties },
    },
  };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const VALIDATORS: Record<keyof typeof COLLECTIONS, object> = {
  settings: strict(
    {
      openingAt: str,
      timezone: { enum: ["Asia/Kolkata"] },
      hours: {
        bsonType: "object",
        required: ["opens", "closes", "days"],
        additionalProperties: false,
        properties: {
          opens: str,
          closes: str,
          days: { bsonType: "array", minItems: 1, items: { enum: DAYS } },
        },
      },
      hoursText: str,
      address: {
        bsonType: "object",
        required: ["line1", "street", "locality", "city", "region", "country"],
        additionalProperties: false,
        properties: {
          line1: str, street: str, locality: str, city: str, region: str,
          postalCode: str, country: { enum: ["IN"] },
        },
      },
      shortAddress: str,
      whatsapp: str,
      instagram: str,
      bookingUrl: str,
      bookingLabel: str,
      mapsUrl: str,
    },
    [
      "openingAt", "timezone", "hours", "hoursText", "address", "shortAddress",
      "whatsapp", "instagram", "bookingUrl", "bookingLabel", "mapsUrl",
    ],
  ),
  zones: strict(
    {
      id: str,
      order: int,
      kicker: str,
      title: str,
      body: str,
      price: str,
      spotLabel: { bsonType: ["string", "null"] },
      cam: { bsonType: "array", minItems: 2, maxItems: 2, items: num },
      yaw: num,
      pitch: num,
      at: { bsonType: ["array", "null"], minItems: 3, maxItems: 3, items: num },
    },
    ["id", "order", "kicker", "title", "body", "price", "spotLabel", "cam", "yaw", "pitch", "at"],
  ),
  prices: strict(
    {
      id: str,
      item: str,
      weekdayRate: nullableInt,
      weekendRate: nullableInt,
      unit: { enum: ["hour", "30 days", "session", "free"] },
      note: str,
      order: int,
    },
    ["id", "item", "weekdayRate", "weekendRate", "unit", "note", "order"],
  ),
};

export const VALIDATION_OPTIONS = { validationLevel: "strict", validationAction: "error" } as const;
