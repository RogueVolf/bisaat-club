"use client";

import { useEffect, useState } from "react";
import { formatCountdown, isOpen } from "@/content/format";

interface Props {
  openingAt: string;
  /** "Opens Sat 12 Dec", formatted on the server */
  opensLabel: string;
  openLabel: string;
  hoursText: string;
  /** Decided on the server at render time, so the first client render matches the HTML */
  initiallyOpen: boolean;
}

/**
 * Header status: "Opens <date>" plus a live countdown until the opening time, then the open label and
 * hours from settings. Switches over in place if the page is left open across the opening minute.
 */
export function OpeningStatus({ openingAt, opensLabel, openLabel, hoursText, initiallyOpen }: Props) {
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    if (open) return;
    const tick = () => {
      const now = Date.now();
      if (isOpen(openingAt, now)) {
        setOpen(true);
        return;
      }
      const el = document.getElementById("count");
      if (el) el.textContent = formatCountdown(openingAt, now);
    };
    tick();
    const id = setInterval(tick, 30000);
    // Switch at the opening moment itself, not up to 30 s later, and catch up straight away when a
    // backgrounded tab (timers throttled or frozen on iOS) becomes visible again.
    const at = setTimeout(tick, Math.max(0, Math.min(Date.parse(openingAt) - Date.now(), 2 ** 31 - 1)));
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      clearTimeout(at);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, openingAt]);

  if (open) {
    return (
      <>
        <b>{openLabel}</b>
        <span key="hours">{hoursText}</span>
      </>
    );
  }
  return (
    <>
      <b>{opensLabel}</b>
      <span key="count" id="count" suppressHydrationWarning></span>
    </>
  );
}
