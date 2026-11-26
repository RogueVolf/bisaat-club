import type { SiteContent } from "@/content/schema";
import { Header } from "./Header";
import { Sheet } from "./Sheet";

export function Stage({ content }: { content: SiteContent }) {
  const zones = [...content.zones].sort((a, b) => a.order - b.order);
  const first = zones[0];
  return (
    <div id="stage">
      <Header settings={content.settings} />
      <div id="view">
        <canvas id="gl" aria-label="A first-person view inside the Bisaat Club room. Drag to look around."></canvas>
        <div id="nogl">This view needs WebGL, which this browser has switched off. Everything you need is below.</div>
        {zones
          .filter((z) => z.spotLabel)
          .map((z) => (
            <button className="spot" data-go={z.id} key={z.id}>
              <i></i>
              <span>{z.spotLabel}</span>
            </button>
          ))}
        <div id="hint">Drag to look around. Tap a spot to walk there.</div>
      </div>
      <Sheet zone={first} settings={content.settings} />
      {/* Task 7: insert <Walkthrough content={content} /> here, at the end of #stage. */}
    </div>
  );
}
