import type { Settings } from "@/content/schema";
import { formatOpensLabel, isOpen } from "@/content/format";
import { ModeToggle } from "./ModeToggle";
import { OpeningStatus } from "./OpeningStatus";

export function Header({ settings }: { settings: Settings }) {
  return (
    <header id="top">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img id="brand" src="/brand/logo.png" alt="Bisaat Club" />
      <div id="right">
        <div id="open">
          <OpeningStatus
            openingAt={settings.openingAt}
            opensLabel={formatOpensLabel(settings.openingAt, settings.timezone)}
            openLabel={settings.openLabel}
            hoursText={settings.hoursText}
            // Server component, rendered per request: the current time is the point, not a purity bug.
            // eslint-disable-next-line react-hooks/purity
            initiallyOpen={isOpen(settings.openingAt, Date.now())}
          />
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
