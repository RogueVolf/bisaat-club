// No `server-only` import: scripts/seed.ts uses this module.

export const COLLECTIONS = { settings: "settings", zones: "zones", prices: "prices" } as const;

const str = { bsonType: "string" };
const int = { bsonType: ["int", "long"] };
const num = { bsonType: ["int", "long", "double"] };
const nullableInt = { bsonType: ["int", "long", "null"] };

// Patterns mirror the zod rules in src/content/schema.ts (tests/unit/server/validators.test.ts runs both on
// the same samples). They are PCRE, anchored with \z (end of subject, unlike `$`, which tolerates a
// trailing newline). Mongo has no URL parser, so the https pattern is a conservative subset of zod's.
export const PATTERNS = {
  openingAt:
    "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|[+-](?:[01]\\d|2[0-3]):[0-5]\\d)\\z",
  time: "^([01]\\d|2[0-3]):[0-5]\\d\\z",
  whatsapp: "^\\+[1-9]\\d{6,14}\\z",
  instagram: "^[A-Za-z0-9._]+\\z",
  httpsUrl: "^https://[^\\s/?#\\\\]+(?:[/?#]\\S*)?\\z",
  bookingUrl: "^(?:https://[^\\s/?#\\\\]+(?:[/?#]\\S*)?|/(?![/\\\\])\\S*)\\z",
  zoneId: "^[a-z][a-z0-9]*\\z",
} as const;

const pat = (pattern: string) => ({ bsonType: "string", pattern });
const nonEmpty = { bsonType: "string", minLength: 1 };

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
      openingAt: pat(PATTERNS.openingAt),
      timezone: { enum: ["Asia/Kolkata"] },
      hours: {
        bsonType: "object",
        required: ["opens", "closes", "days"],
        additionalProperties: false,
        properties: {
          opens: pat(PATTERNS.time),
          closes: pat(PATTERNS.time),
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
      whatsapp: pat(PATTERNS.whatsapp),
      instagram: pat(PATTERNS.instagram),
      bookingUrl: pat(PATTERNS.bookingUrl),
      bookingLabel: nonEmpty,
      mapsUrl: pat(PATTERNS.httpsUrl),
    },
    [
      "openingAt", "timezone", "hours", "hoursText", "address", "shortAddress",
      "whatsapp", "instagram", "bookingUrl", "bookingLabel", "mapsUrl",
    ],
  ),
  zones: strict(
    {
      id: pat(PATTERNS.zoneId),
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
      id: nonEmpty,
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
