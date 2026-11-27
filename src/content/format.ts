export function formatCountdown(openingAt: string, now: number): string {
  const m = Math.max(0, Math.floor((Date.parse(openingAt) - now) / 60000));
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h ${m % 60}m to go`;
}

/** True from the opening minute onwards. */
export function isOpen(openingAt: string, now: number): boolean {
  return now >= Date.parse(openingAt);
}

export function formatOpensLabel(openingAt: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(new Date(openingAt));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `Opens ${get("weekday")} ${get("day")} ${get("month")}`;
}
