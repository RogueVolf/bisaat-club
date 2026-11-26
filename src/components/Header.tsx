import type { Settings } from "@/content/schema";
import { formatOpensLabel } from "@/content/format";
import { Countdown } from "./Countdown";
import { ModeToggle } from "./ModeToggle";

export function Header({ settings }: { settings: Settings }) {
  return (
    <header id="top">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img id="brand" src="/brand/logo.png" alt="Bisaat Club" />
      <div id="right">
        <div id="open">
          <b>{formatOpensLabel(settings.openingAt, settings.timezone)}</b>
          <Countdown openingAt={settings.openingAt} />
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
