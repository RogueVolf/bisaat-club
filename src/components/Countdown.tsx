"use client";

import { useEffect } from "react";
import { formatCountdown } from "@/content/format";

export function Countdown({ openingAt }: { openingAt: string }) {
  useEffect(() => {
    const tick = () => {
      const el = document.getElementById("count");
      if (el) el.textContent = formatCountdown(openingAt, Date.now());
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [openingAt]);
  return <span id="count" suppressHydrationWarning></span>;
}
