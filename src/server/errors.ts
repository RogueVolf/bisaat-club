// App-owned errors whose messages are fixed and safe to log: they never contain URIs, values or env contents.

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export class TlsPolicyError extends Error {
  constructor(message = "MongoDB connection must use TLS with certificate checks in production") {
    super(message);
    this.name = "TlsPolicyError";
  }
}
