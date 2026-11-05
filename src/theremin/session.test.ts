import { describe, expect, it } from "vitest";

import {
  centsBetween,
  HoldJudge,
  inTune,
  judgeShare,
  LEARN,
  PLAY,
  Session,
  starsFor,
  WINDOW,
} from "./session";
import { SONGS, songBeats, type Song } from "./songs";
import { HIGH_MIDI, LOW_MIDI, SCALE_NOTES } from "./pitch";

const tiny: Song = {
  id: "t",
  title: "t",
  bpm: 60,
  beatsPerBar: 2,
  pickup: 0,
  notes: [
    { midi: 60, beats: 1 },
    { midi: 62, beats: 1 },
    { midi: 64, beats: 2 },
  ],
  chords: ["I", "I"],
};

describe("the in-tune judge", () => {
  it("measures cents either side", () => {
    expect(centsBetween(69.3, 69)).toBeCloseTo(30, 9);
    expect(centsBetween(68.6, 69)).toBeCloseTo(40, 9);
    expect(inTune(69.39, 69, 40)).toBe(true);
    expect(inTune(68.59, 69, 40)).toBe(false);
  });

  it("Learn counts a note held in tune and loud enough for 0.4 s", () => {
    const j = new HoldJudge();
    let done = false;
    for (let i = 0; i < 11; i += 1) done = j.push(0.033, 64.3, 0.5, 64);
    expect(done).toBe(false);
    for (let i = 0; i < 2; i += 1) done = j.push(0.033, 64.3, 0.5, 64);
    expect(done).toBe(true);
    expect(LEARN.hold).toBe(0.4);
  });

  it("Learn restarts the hold when the pitch drifts out or the volume drops", () => {
    const j = new HoldJudge();
    for (let i = 0; i < 10; i += 1) j.push(0.033, 64, 0.5, 64);
    j.push(0.033, 64.5, 0.5, 64); // 50 cents off
    expect(j.held).toBe(0);
    for (let i = 0; i < 10; i += 1) j.push(0.033, 64, 0.5, 64);
    j.push(0.033, 64, LEARN.volume - 0.01, 64); // too quiet
    expect(j.held).toBe(0);
  });

  it("Learn walks the song note by note, with no timing", () => {
    const s = new Session(tiny, "learn", 1, 0);
    let t = 0;
    const hold = (midi: number, secs: number) => {
      for (let i = 0; i < secs * 30; i += 1) {
        t += 1 / 30;
        s.update(t, midi, 0.6);
      }
    };
    hold(62, 1); // the wrong note: nothing happens
    expect(s.next).toBe(0);
    hold(60, 0.5);
    expect(s.next).toBe(1);
    t += 20; // a long pause is fine
    hold(62, 0.5);
    hold(64, 0.5);
    expect(s.done).toBe(true);
    expect(s.results).toEqual(["good", "good", "good"]);
  });
});

describe("Play scoring", () => {
  it("judges a note by its share in tune", () => {
    expect(judgeShare(0.7)).toBe("perfect");
    expect(judgeShare(0.69)).toBe("good");
    expect(judgeShare(0.4)).toBe("good");
    expect(judgeShare(0.39)).toBe("miss");
  });

  /** Plays `tiny` from t = 0 with `play(t)` giving [midi, volume]. */
  const run = (play: (beat: number) => [number, number]) => {
    const s = new Session(tiny, "play", 1, 0);
    for (let t = 0; t < 10 && !s.done; t += 1 / 60) {
      const [m, v] = play(s.beatAt(t));
      s.update(t, m, v);
    }
    return s;
  };
  const melody = (b: number) => {
    if (b < 1) return 60;
    if (b < 2) return 62;
    return 64;
  };

  it("scores a song played in tune as perfect, with 3 stars", () => {
    const s = run((b) => [melody(b), b >= 0 ? 0.6 : 0]);
    expect(s.results).toEqual(["perfect", "perfect", "perfect"]);
    expect(s.stars).toBe(3);
  });

  it("counts only the share in tune (±50 cents) and sounding", () => {
    // First note in tune for half its length; second 60 cents off; third silent.
    const s = run((b) => {
      if (b < 0) return [0, 0];
      if (b < 1) return [60.3, b < 0.5 ? 0.6 : 0];
      if (b < 2) return [62.6, 0.6];
      return [64, PLAY.volume / 2];
    });
    expect(s.results).toEqual(["good", "miss", "miss"]);
    expect(s.stars).toBe(1);
  });

  it("gives a little room for the hands' delay", () => {
    // Every note played 0.1 s late still counts.
    const s = run((b) => [melody(b - 0.1), b >= 0.1 ? 0.6 : 0]);
    expect(s.results.every((r) => r === "perfect")).toBe(true);
    expect(WINDOW.late).toBeGreaterThanOrEqual(0.1);
  });

  it("gives stars by the whole song", () => {
    expect(starsFor(["perfect", "perfect", "good"])).toBe(3);
    expect(starsFor(["perfect", "good", "miss"])).toBe(2);
    expect(starsFor(["miss", "miss", "good"])).toBe(1);
  });

  it("plays slower at 0.75×", () => {
    const s = new Session(tiny, "play", 0.75, 0);
    expect(s.secondsPerBeat).toBeCloseTo(1 / 0.75, 9);
    expect(new Session(tiny, "learn", 0.75, 0).speed).toBe(1);
  });
});

describe("the songs", () => {
  it("are four, each in range and in C major", () => {
    expect(SONGS).toHaveLength(4);
    SONGS.forEach((song) => {
      song.notes.forEach((x) => {
        expect(x.midi).toBeGreaterThanOrEqual(LOW_MIDI);
        expect(x.midi).toBeLessThanOrEqual(HIGH_MIDI);
        expect(SCALE_NOTES).toContain(x.midi);
        expect(x.beats).toBeGreaterThan(0);
      });
    });
  });

  it("fill whole bars, with one chord per bar", () => {
    SONGS.forEach((song) => {
      const bars = songBeats(song) / song.beatsPerBar;
      expect(Number.isInteger(bars)).toBe(true);
      expect(song.chords).toHaveLength(bars);
    });
  });

  it("have unique ids", () => {
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length);
  });
});
