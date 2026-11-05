import { describe, expect, it } from "vitest";

import {
  FADE,
  FIST,
  HandPlayer,
  ONE_HAND,
  OneEuro,
  PITCH_ZONE,
  PitchZone,
  VOLUME_ZONE,
  volumeOf,
  type HandsIn,
} from "./handPlay";

/** Runs the player at 30 readings / s from `t0` for `secs`, with these hands. */
const run = (
  p: HandPlayer,
  t0: number,
  secs: number,
  hands: Omit<HandsIn, "t">,
) => {
  let out = p.out;
  const n = Math.round(secs * 30);
  for (let i = 1; i <= n; i += 1) out = p.update({ t: t0 + i / 30, ...hands });
  return { out: { ...out }, t: t0 + n / 30 };
};

describe("pitch from the pitch hand", () => {
  it("maps the zone across the picture over the two octaves", () => {
    const z = new PitchZone();
    expect(z.pitch(PITCH_ZONE.lo)).toBe(0);
    expect(z.pitch(PITCH_ZONE.hi)).toBe(1);
    expect(z.pitch((PITCH_ZONE.lo + PITCH_ZONE.hi) / 2)).toBeCloseTo(0.5, 9);
    // Left of the zone (towards the middle of the picture) stays at the bottom.
    expect(z.pitch(0.2)).toBe(0);
  });

  it("widens gently when you reach past it, and never narrows", () => {
    const z = new PitchZone();
    z.push(0.3, 1 / 30);
    expect(z.lo).toBeLessThan(PITCH_ZONE.lo);
    expect(z.lo).toBeGreaterThan(0.3);
    for (let i = 0; i < 60; i += 1) z.push(0.3, 1 / 30);
    expect(z.lo).toBeCloseTo(0.3, 2);
    z.push(0.6, 1 / 30);
    expect(z.lo).toBeCloseTo(0.3, 2);
    // Never past its limits.
    for (let i = 0; i < 60; i += 1) z.push(-0.5, 1 / 30);
    expect(z.lo).toBeGreaterThanOrEqual(PITCH_ZONE.least);
    for (let i = 0; i < 60; i += 1) z.push(1.4, 1 / 30);
    expect(z.hi).toBeLessThanOrEqual(PITCH_ZONE.most);
  });

  it("further right plays higher", () => {
    const p = new HandPlayer();
    const low = run(p, 0, 1, {
      pitch: { x: 0.5, y: 0.5 },
      volume: { x: 0.2, y: 0.4 },
      fist: false,
    });
    const high = run(p, low.t, 1, {
      pitch: { x: 0.9, y: 0.5 },
      volume: { x: 0.2, y: 0.4 },
      fist: false,
    });
    expect(high.out.pitch).toBeGreaterThan(low.out.pitch + 0.5);
  });
});

describe("smoothing", () => {
  it("takes out frame-to-frame jitter", () => {
    const f = new OneEuro();
    let worst = 0;
    for (let i = 0; i < 120; i += 1) {
      const v = f.push(i / 30, 0.6 + (i % 2 ? 0.01 : -0.01));
      if (i > 30) worst = Math.max(worst, Math.abs(v - 0.6));
    }
    expect(worst).toBeLessThan(0.006);
  });

  it("keeps a slow tremble (a vibrato) and follows a move", () => {
    const f = new OneEuro();
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 180; i += 1) {
      const t = i / 30;
      const v = f.push(t, 0.6 + 0.01 * Math.sin(2 * Math.PI * 1.5 * t));
      if (i > 60) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
    // Most of a 1.5 Hz tremble survives.
    expect(hi - lo).toBeGreaterThan(0.012);
    for (let i = 180; i < 200; i += 1) f.push(i / 30, 0.8);
    expect(f.value!).toBeGreaterThan(0.78);
  });
});

describe("volume from the volume hand", () => {
  it("is silent below the zone and full at its top, rising on a curve", () => {
    expect(volumeOf(0.95)).toBe(0);
    expect(volumeOf(VOLUME_ZONE.bottom)).toBe(0);
    expect(volumeOf(VOLUME_ZONE.top)).toBe(1);
    expect(volumeOf(0.05)).toBe(1);
    const mid = volumeOf((VOLUME_ZONE.bottom + VOLUME_ZONE.top) / 2);
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.5);
  });

  it("follows the hand at once", () => {
    const p = new HandPlayer();
    const r = run(p, 0, 0.2, {
      pitch: { x: 0.7, y: 0.5 },
      volume: { x: 0.2, y: VOLUME_ZONE.top },
      fist: false,
    });
    expect(r.out.volume).toBe(1);
  });
});

describe("a fist mutes", () => {
  it("after it has held for a moment, quickly", () => {
    const p = new HandPlayer();
    const on = run(p, 0, 0.5, {
      pitch: { x: 0.7, y: 0.5 },
      volume: { x: 0.2, y: 0.4 },
      fist: false,
    });
    expect(on.out.volume).toBeGreaterThan(0.5);
    // A blink of a fist does nothing.
    const blink = run(p, on.t, FIST.hold - 0.05, {
      pitch: { x: 0.7, y: 0.5 },
      volume: { x: 0.2, y: 0.4 },
      fist: true,
    });
    expect(blink.out.muted).toBe(false);
    expect(blink.out.volume).toBeCloseTo(on.out.volume, 5);
    // Held, it mutes within the hold plus the short fade.
    const held = run(p, blink.t, 0.05 + FIST.fade + 0.05, {
      pitch: { x: 0.7, y: 0.5 },
      volume: { x: 0.2, y: 0.4 },
      fist: true,
    });
    expect(held.out.muted).toBe(true);
    expect(held.out.volume).toBe(0);
    // Opening the hand plays again.
    const open = run(p, held.t, 0.1, {
      pitch: { x: 0.7, y: 0.5 },
      volume: { x: 0.2, y: 0.4 },
      fist: false,
    });
    expect(open.out.volume).toBeGreaterThan(0.5);
  });
});

describe("lost hands", () => {
  it("a lost pitch hand holds its pitch and fades out over 0.3 s", () => {
    const p = new HandPlayer();
    const on = run(p, 0, 0.5, {
      pitch: { x: 0.8, y: 0.5 },
      volume: { x: 0.2, y: 0.3 },
      fist: false,
    });
    const half = run(p, on.t, FADE / 2, {
      pitch: null,
      volume: { x: 0.2, y: 0.3 },
      fist: false,
    });
    expect(half.out.pitch).toBeCloseTo(on.out.pitch, 9);
    expect(half.out.volume).toBeGreaterThan(0);
    expect(half.out.volume).toBeLessThan(on.out.volume);
    const gone = run(p, half.t, FADE / 2 + 0.05, {
      pitch: null,
      volume: { x: 0.2, y: 0.3 },
      fist: false,
    });
    expect(gone.out.volume).toBe(0);
    expect(gone.out.pitch).toBeCloseTo(on.out.pitch, 9);
  });

  it("a lost volume hand fades to silent over 0.3 s", () => {
    const p = new HandPlayer();
    const on = run(p, 0, 0.5, {
      pitch: { x: 0.8, y: 0.5 },
      volume: { x: 0.2, y: VOLUME_ZONE.top },
      fist: false,
    });
    expect(on.out.volume).toBe(1);
    const gone = run(p, on.t, FADE + 0.05, {
      pitch: { x: 0.8, y: 0.5 },
      volume: null,
      fist: false,
    });
    expect(gone.out.volume).toBe(0);
  });

  it("both hands gone: silent, and the hands stop playing", () => {
    const p = new HandPlayer();
    const on = run(p, 0, 0.5, {
      pitch: { x: 0.8, y: 0.5 },
      volume: { x: 0.2, y: 0.3 },
      fist: false,
    });
    const gone = run(p, on.t, 0.5, { pitch: null, volume: null, fist: false });
    expect(gone.out.volume).toBe(0);
    expect(gone.out.active).toBe(false);
  });
});

describe("one-hand play", () => {
  it("is on by default", () => {
    expect(ONE_HAND.on).toBe(true);
  });

  it("plays at a medium volume with only the pitch hand in view", () => {
    const p = new HandPlayer();
    const first = run(p, 0, 0.2, {
      pitch: { x: 0.7, y: 0.5 },
      volume: null,
      fist: false,
    });
    // Not at once (the other hand may just be coming into view).
    expect(first.out.volume).toBe(0);
    const later = run(p, first.t, ONE_HAND.after + ONE_HAND.rise + 0.1, {
      pitch: { x: 0.7, y: 0.5 },
      volume: null,
      fist: false,
    });
    expect(later.out.oneHand).toBe(true);
    expect(later.out.volume).toBeCloseTo(ONE_HAND.volume, 5);
  });

  it("gives way to the volume hand when it comes", () => {
    const p = new HandPlayer();
    const one = run(p, 0, 1.5, {
      pitch: { x: 0.7, y: 0.5 },
      volume: null,
      fist: false,
    });
    expect(one.out.oneHand).toBe(true);
    const two = run(p, one.t, 0.1, {
      pitch: { x: 0.7, y: 0.5 },
      volume: { x: 0.2, y: 0.95 },
      fist: false,
    });
    expect(two.out.oneHand).toBe(false);
    expect(two.out.volume).toBe(0);
  });
});
