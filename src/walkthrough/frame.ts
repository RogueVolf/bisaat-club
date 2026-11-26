import type { HotspotPlacement } from "./hotspots";

/** The reference sharpens to full resolution this long after the last moving frame. */
export const SHARPEN_MS = 140;

export interface LoopState { dirty: boolean; walking: boolean; dragging: boolean; fading: boolean; lowRes: boolean }

/**
 * True while the frame loop must keep running: something to draw, a walk, drag or day/night fade in
 * progress, or a low-res frame still waiting to sharpen. Otherwise the loop stops until the next change.
 */
export function needsFrame(s: LoopState): boolean {
  return s.dirty || s.walking || s.dragging || s.fading || s.lowRes;
}

/**
 * The reference moving-resolution policy, with one fix: the canvas only drops to low res when a moving
 * frame is about to draw. Reallocating the backing store clears it, so dropping on a frame with nothing
 * to draw (a press without movement) left the room blank until the sharpen 140 ms later.
 */
export function resolutionStep(s: { moving: boolean; dirty: boolean; lowRes: boolean; now: number; sharpAt: number }): { low: boolean; sharpAt: number } {
  if (s.moving) return { low: s.lowRes || s.dirty, sharpAt: s.now + SHARPEN_MS };
  if (s.lowRes && s.now > s.sharpAt) return { low: false, sharpAt: s.sharpAt };
  return { low: s.lowRes, sharpAt: s.sharpAt };
}

export type SpotDom = { hidden: true } | { hidden: false; right: boolean; transform: string };
export interface SpotCache { hidden?: boolean; right?: boolean; transform?: string }

/** The DOM state the reference gives a spot for a placement (a hidden spot keeps its old position). */
export function spotDom(p: HotspotPlacement): SpotDom {
  if (p.hidden) return { hidden: true };
  if (!p.pinned) return { hidden: false, right: false, transform: 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)' };
  if (p.side === 'l') return { hidden: false, right: false, transform: 'translate(' + p.x + 'px,' + p.y + 'px)' };
  return { hidden: false, right: true, transform: 'translate(' + p.x + 'px,' + p.y + 'px) translateX(-100%)' };
}

/** The fields that differ from what was last written, so unchanged spots cost no DOM writes. */
export function spotWrites(prev: SpotCache, next: SpotDom): SpotCache {
  const out: SpotCache = {};
  if (prev.hidden !== next.hidden) out.hidden = next.hidden;
  if (next.hidden) return out;
  if (prev.right !== next.right) out.right = next.right;
  if (prev.transform !== next.transform) out.transform = next.transform;
  return out;
}
