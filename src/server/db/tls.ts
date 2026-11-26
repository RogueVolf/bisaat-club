/** In production the connection must use TLS. Never includes the URI in the error. */
export function assertTlsPolicy(uri: string, nodeEnv: string): void {
  if (nodeEnv !== "production") return;
  if (uri.startsWith("mongodb+srv://")) return;
  const query = uri.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  if (params.get("tls") === "true" || params.get("ssl") === "true") return;
  throw new Error("MongoDB connection must use TLS in production (mongodb+srv:// or tls=true)");
}
