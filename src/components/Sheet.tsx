import type { Settings, Zone } from "@/content/schema";

export function Sheet({ zone, settings }: { zone: Zone; settings: Settings }) {
  return (
    <div id="sheet">
      <div id="copy" aria-live="polite">
        <div id="kicker">{zone.kicker}</div>
        <h1 id="title">{zone.title}</h1>
        <div id="rule"></div>
        <p id="body">{zone.body}</p>
        <div id="price">{zone.price}</div>
      </div>
      <div id="actions">
        <button id="next">Next room</button>
        <a id="book" target="_blank" rel="noopener" href={settings.bookingUrl}>
          {settings.bookingLabel}
        </a>
      </div>
      <a id="find" target="_blank" rel="noopener" href={settings.mapsUrl}>
        {`Find us · ${settings.shortAddress}`}
      </a>
    </div>
  );
}
