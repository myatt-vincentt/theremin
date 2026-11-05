// The pitch hand's play zone across the camera picture (no scene).

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The pitch zone across the picture (share of its width), and how far it may widen. */
export const PITCH_ZONE = { lo: 0.45, hi: 0.95, least: 0.25, most: 1 };
/** Reaching past an edge moves it this share of the way out per second. */
export const ZONE_WIDEN = 3;

/** The pitch hand's zone: widens (gently) when you reach past it, never narrows. */
export class PitchZone {
  lo = PITCH_ZONE.lo;

  hi = PITCH_ZONE.hi;

  /** A palm at `x` for `dt` s. */
  push(x: number, dt: number) {
    const k = 1 - Math.exp(-ZONE_WIDEN * Math.max(0, dt));
    if (x > this.hi)
      this.hi = Math.min(PITCH_ZONE.most, this.hi + (x - this.hi) * k);
    if (x < this.lo)
      this.lo = Math.max(PITCH_ZONE.least, this.lo + (x - this.lo) * k);
  }

  /** The pitch (0 C4 … 1 C6) of a palm at `x`. */
  pitch(x: number) {
    return clamp01((x - this.lo) / Math.max(0.05, this.hi - this.lo));
  }

  reset() {
    this.lo = PITCH_ZONE.lo;
    this.hi = PITCH_ZONE.hi;
  }
}
