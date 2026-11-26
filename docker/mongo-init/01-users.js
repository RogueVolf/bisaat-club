// Runs once on first start of an empty data volume (mongosh).
const appDb = db.getSiblingDB("bisaat");

appDb.createRole({
  role: "bisaatSchemaMaintainer",
  privileges: [
    {
      resource: { db: "bisaat", collection: "" },
      actions: ["collMod", "createCollection", "createIndex"],
    },
  ],
  roles: [],
});

appDb.createUser({
  user: "bisaat_ro",
  pwd: process.env.MONGO_APP_RO_PASSWORD,
  roles: [{ role: "read", db: "bisaat" }],
});

appDb.createUser({
  user: "bisaat_rw",
  pwd: process.env.MONGO_APP_RW_PASSWORD,
  roles: [
    { role: "readWrite", db: "bisaat" },
    { role: "bisaatSchemaMaintainer", db: "bisaat" },
  ],
});
