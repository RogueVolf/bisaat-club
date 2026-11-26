export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export interface CspOptions {
  isDev: boolean;
  /** true when the request reached us over HTTPS (directly or via the proxy's x-forwarded-proto) */
  https: boolean;
}

export function buildCsp(nonce: string, { isDev, https }: CspOptions): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  // Only over HTTPS: Safari also applies it to http://localhost and LAN addresses, rewriting every
  // asset to https://, which leaves a dead page when testing a production build on an iPhone over Wi-Fi.
  if (!isDev && https) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
