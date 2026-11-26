import type { Settings } from "@/content/schema";
import { formatOpensLabel } from "@/content/format";
import { Countdown } from "./Countdown";
import { ModeToggle } from "./ModeToggle";

export function Header({ settings }: { settings: Settings }) {
  return (
    <header id="top">
      {/* Sized for the 168x42 box (scripts/make-header-logo.ts); the room's sign texture uses the full /brand/logo.png */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img id="brand" src="/brand/logo-header.png" srcSet="/brand/logo-header.png 1x, /brand/logo-header@2x.png 2x, /brand/logo-header@3x.png 3x" alt="Bisaat Club" />
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
