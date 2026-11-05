import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import {
  frameRect,
  keepPoints,
  LOOP,
  phoneness,
  PITCH_AXIS,
  pitchHandPos,
  pitchReach,
  reachToPitch,
  viewMargins,
  volumeHandPos,
} from "./layout";

const fromRod = (p: Vector3) =>
  Math.hypot(p.x - PITCH_AXIS.bottom.x, p.z - PITCH_AXIS.bottom.z);

describe("the layout", () => {
  it("reads a laptop as wide and a phone as tall", () => {
    expect(phoneness(16 / 9)).toBe(0);
    expect(phoneness(390 / 844)).toBe(1);
  });

  it("keeps the corner camera in the top-right corner", () => {
    const r = frameRect(1440, 900);
    expect(r.left + r.width).toBe(1440 - 16);
    expect(r.top).toBe(16);
  });

  it("keeps room for the dock and the readout below, and the corner camera above", () => {
    const m = viewMargins(390, 844);
    expect(m.bottom).toBeLessThan(0.7);
    expect(m.under).toBeLessThan(m.top);
  });

  it("keeps the theremin in view, above the floor", () => {
    (["front", "player", "close"] as const).forEach((v) => {
      keepPoints(v).forEach((p) => {
        expect(p.y).toBeGreaterThan(0.5);
        expect(Math.hypot(p.x, p.z + 0.3)).toBeLessThan(1);
      });
    });
  });
});

describe("the ghost hands", () => {
  it("bring the pitch hand nearer the antenna for higher notes", () => {
    const low = fromRod(pitchHandPos(0, new Vector3()));
    const mid = fromRod(pitchHandPos(0.5, new Vector3()));
    const high = fromRod(pitchHandPos(1, new Vector3()));
    expect(low).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(high);
    // The root (wrist) stays clear of the rod even at the top.
    expect(high).toBeGreaterThan(0.08);
    // The height does not change.
    expect(pitchHandPos(1, new Vector3()).y).toBeCloseTo(
      pitchHandPos(0, new Vector3()).y,
      9,
    );
  });

  it("maps the fingertips' distance back to the pitch", () => {
    [0, 0.25, 0.6, 1].forEach((p) =>
      expect(reachToPitch(pitchReach(p))).toBeCloseTo(p, 9),
    );
    expect(reachToPitch(2)).toBe(0);
    expect(reachToPitch(0)).toBe(1);
  });

  it("raise the volume hand over the loop for louder", () => {
    const quiet = volumeHandPos(0, new Vector3());
    const loud = volumeHandPos(1, new Vector3());
    expect(loud.y).toBeGreaterThan(quiet.y + 0.2);
    expect(quiet.y).toBeGreaterThan(LOOP.center.y);
    expect(loud.x).toBeCloseTo(quiet.x, 9);
  });
});
