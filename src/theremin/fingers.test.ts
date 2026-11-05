import { describe, expect, it } from "vitest";

import { fingersUp, isFist, type Joint } from "./fingers";

/** A flat hand (wrist at the origin, fingers along +y), each finger straight or curled. */
const hand = (curled: boolean[]): Joint[] => {
  const j: Joint[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  j[0] = { x: 0, y: 0, z: 0 };
  [0, 1, 2, 3].forEach((f) => {
    const x = -0.03 + 0.02 * f;
    const base = 5 + 4 * f;
    j[base] = { x, y: 0.09, z: 0 };
    j[base + 1] = { x, y: 0.125, z: 0 };
    if (curled[f]) {
      j[base + 2] = { x, y: 0.13, z: 0.025 };
      j[base + 3] = { x, y: 0.11, z: 0.035 };
    } else {
      j[base + 2] = { x, y: 0.15, z: 0 };
      j[base + 3] = { x, y: 0.17, z: 0 };
    }
  });
  return j;
};

describe("fingers", () => {
  it("reads an open hand as all up", () => {
    expect(fingersUp(hand([false, false, false, false]))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(isFist(fingersUp(hand([false, false, false, false])))).toBe(false);
  });

  it("reads a fist", () => {
    expect(isFist(fingersUp(hand([true, true, true, true])))).toBe(true);
  });

  it("one finger up is not a fist", () => {
    expect(isFist(fingersUp(hand([false, true, true, true])))).toBe(false);
  });
});
