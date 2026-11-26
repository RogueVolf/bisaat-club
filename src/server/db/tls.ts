/** In production the connection must use TLS. Never includes the URI in the error. */
export function assertTlsPolicy(uri: string, nodeEnv: string): void {
  if (nodeEnv !== "production") return;
  const params = new Map<string, string>();
  for (const [k, v] of new URLSearchParams(uri.split("?")[1] ?? "")) {
    params.set(k.toLowerCase(), v.toLowerCase());
  }
  const weakened =
    params.get("tls") === "false" ||
    params.get("ssl") === "false" ||
    params.get("tlsinsecure") === "true" ||
    params.get("tlsallowinvalidcertificates") === "true" ||
    params.get("tlsallowinvalidhostnames") === "true";
  const secure =
    uri.startsWith("mongodb+srv://") || params.get("tls") === "true" || params.get("ssl") === "true";
  if (weakened || !secure) {
    throw new Error("MongoDB connection must use TLS with certificate checks in production");
  }
}
