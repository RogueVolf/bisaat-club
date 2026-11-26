import path from "node:path";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env: integration tests skip themselves
}

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: { "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.ts"],
  },
});
