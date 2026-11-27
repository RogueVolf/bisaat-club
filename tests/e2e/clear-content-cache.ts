import { rmSync } from "node:fs";

export default function globalTeardown() {
  rmSync(".next/cache/fetch-cache", { recursive: true, force: true });
}
