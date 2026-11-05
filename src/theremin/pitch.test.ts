import { describe, expect, it } from "vitest";

import {
  centsOff,
  HIGH_MIDI,
  KEY_NOTES,
  LOW_MIDI,
  midiToHz,
  midiToPitch,
  nearestScaleNote,
  noteName,
  pitchHue,
  pitchToMidi,
  SCALE_NOTES,
  screenToPlay,
  snapToScale,
  SNAP_HOLD,
  targetMidi,
  volumeToGain,
} from "./pitch";

describe("pitch mapping", () => {
  it("spans two octaves, C4 to C6", () => {
    expect(pitchToMidi(0)).toBe(60);
    expect(pitchToMidi(1)).toBe(84);
    expect(pitchToMidi(0.5)).toBe(72);
    expect(HIGH_MIDI - LOW_MIDI).toBe(24);
  });

  it("clamps outside the range", () => {
    expect(pitchToMidi(-1)).toBe(60);
    expect(pitchToMidi(2)).toBe(84);
    expect(midiToPitch(40)).toBe(0);
    expect(midiToPitch(100)).toBe(1);
  });

  it("round-trips pitch and MIDI", () => {
    [0, 0.13, 0.5, 0.77, 1].forEach((p) =>
      expect(midiToPitch(pitchToMidi(p))).toBeCloseTo(p, 9),
    );
  });

  it("is even in semitones (an octave doubles the frequency)", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(pitchToMidi(1)) / midiToHz(pitchToMidi(0.5))).toBeCloseTo(
      2,
      9,
    );
    expect(midiToHz(60)).toBeCloseTo(261.626, 2);
  });

  it("names notes", () => {
    expect(noteName(60)).toBe("C4");
    expect(noteName(69)).toBe("A4");
    expect(noteName(84)).toBe("C6");
    expect(noteName(61.4)).toBe("C♯4");
    expect(centsOff(69.12)).toBe(12);
    expect(centsOff(68.9)).toBe(-10);
  });
});

describe("scale snapping", () => {
  it("has the C major notes from C4 to C6", () => {
    expect(SCALE_NOTES).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84,
    ]);
  });

  it("snaps to the nearest C major note", () => {
    expect(nearestScaleNote(60.4)).toBe(60);
    expect(nearestScaleNote(61.6)).toBe(62);
    expect(nearestScaleNote(64.4)).toBe(64);
    expect(nearestScaleNote(64.6)).toBe(65);
    expect(nearestScaleNote(90)).toBe(84);
    expect(nearestScaleNote(50)).toBe(60);
  });

  it("only ever sounds scale notes", () => {
    for (let m = 58; m <= 86; m += 0.07)
      expect(SCALE_NOTES).toContain(snapToScale(m));
  });

  it("holds the sounding note past the border (no flicker)", () => {
    // D4 → E4: the border is at 63.
    expect(snapToScale(63.1, 62)).toBe(62);
    expect(snapToScale(63 + SNAP_HOLD - 0.01, 62)).toBe(62);
    expect(snapToScale(63 + SNAP_HOLD + 0.01, 62)).toBe(64);
    // Coming back down it holds E4 the same way.
    expect(snapToScale(62.9, 64)).toBe(64);
    expect(snapToScale(63 - SNAP_HOLD - 0.01, 64)).toBe(62);
  });

  it("lets go at once when the hand jumps far", () => {
    expect(snapToScale(79.2, 62)).toBe(79);
  });

  it("is smooth in Free and snapped in Scale", () => {
    expect(targetMidi(0.52, "free")).toBeCloseTo(72.48, 9);
    expect(targetMidi(0.52, "scale")).toBe(72);
  });
});

describe("keys", () => {
  it("A S D F G H J K play C D E F G A B C", () => {
    expect(
      ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK"].map(
        (k) => noteName(KEY_NOTES[k]),
      ),
    ).toEqual(["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
  });
});

describe("volume", () => {
  it("is exactly silent at 0 and full at 1", () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(-0.2)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
  });

  it("rises steadily", () => {
    let last = 0;
    for (let v = 0.05; v <= 1; v += 0.05) {
      const g = volumeToGain(v);
      expect(g).toBeGreaterThan(last);
      last = g;
    }
  });
});

describe("mouse and touch", () => {
  it("towards the antenna is higher, up is louder", () => {
    const left = screenToPlay(0.1, 0.12, true);
    expect(left.pitch).toBe(1);
    expect(left.volume).toBe(1);
    const right = screenToPlay(0.9, 0.88, true);
    expect(right.pitch).toBe(0);
    expect(right.volume).toBe(0);
    // Seen from behind the antenna is on the right.
    expect(screenToPlay(0.9, 0.5, false).pitch).toBe(1);
    expect(screenToPlay(0.5, 0.5, false).volume).toBeCloseTo(0.5, 9);
  });

  it("clamps at the screen's edges", () => {
    const p = screenToPlay(-0.2, 1.4, false);
    expect(p.pitch).toBe(0);
    expect(p.volume).toBe(0);
  });
});

describe("pitch colour", () => {
  it("runs from teal at the bottom to warm at the top", () => {
    expect(pitchHue(0)).toBeCloseTo(0.48, 9);
    expect(pitchHue(1)).toBeCloseTo(0.08, 9);
    expect(pitchHue(0.5)).toBeCloseTo(0.78, 9);
  });
});
