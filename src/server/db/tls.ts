const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True only for a plain mongodb:// URI whose every host is loopback (ports optional). */
function isLoopbackOnly(uri: string): boolean {
  if (!uri.startsWith("mongodb://")) return false;
  let authority = uri.slice("mongodb://".length).split(/[/?]/)[0] ?? "";
  authority = authority.slice(authority.lastIndexOf("@") + 1);
  if (!authority) return false;
  return authority.split(",").every((hostPort) => {
    const host = hostPort.replace(/:\d+$/, "").toLowerCase();
    return LOOPBACK.has(host);
  });
}

/** In production the connection must use TLS, except to loopback hosts. Never includes the URI in the error. */
export function assertTlsPolicy(uri: string, nodeEnv: string): void {
  if (nodeEnv !== "production") return;
  if (isLoopbackOnly(uri)) return;
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
