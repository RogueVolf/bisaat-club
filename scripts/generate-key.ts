// Prints a new DATA_ENCRYPTION_KEY (32 random bytes, base64). Run: npm run key:generate
// Store it in Vercel (sensitive env var) and in the owner's password manager: without it, encrypted data is unrecoverable.
import { randomBytes } from "node:crypto";

console.log(randomBytes(32).toString("base64"));
