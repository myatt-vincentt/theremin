// The songs' sounds, made in code: a soft count-in click, a quiet warm pad
// holding each bar's chord under the theremin (Play), and a soft chime when
// a note counts (Learn) or a song ends. Scheduled on the audio clock; a stop
// cuts it.
import { CHORD_MIDI, type Chord } from "./songs";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Loudness of each part (the theremin leads). */
const LEVEL = {
  click: 0.12,
  accent: 0.18,
  pad: 0.035,
  chime: 0.05,
  ding: 0.035,
};

export type Backing = {
  click(at: number, accent: boolean): void;
  chord(chord: Chord, at: number, seconds: number): void;
  /** One soft bell on this note (a note counted). */
  ding(midi: number, at: number): void;
  /** A short rising chime (a song finished). */
  chime(at: number): void;
  /** Cuts everything still sounding or due. */
  cut(now: number): void;
};

export const makeBacking = (ctx: AudioContext, out: AudioNode): Backing => {
  const bus = ctx.createGain();
  bus.connect(out);
  let live: Array<{ stop: (t: number) => void }> = [];

  const tone = (
    type: OscillatorType,
    freq: number,
    at: number,
    level: number,
    attack: number,
    hold: number,
    release: number,
    filter = 2400,
    detune = 0,
  ) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + attack);
    g.gain.setTargetAtTime(0, at + attack + hold, release / 3);
    o.connect(lp).connect(g).connect(bus);
    o.start(at);
    o.stop(at + attack + hold + release * 2);
    const h = {
      stop: (t: number) => {
        g.gain.cancelScheduledValues(t);
        g.gain.setTargetAtTime(0, t, 0.03);
        try {
          o.stop(t + 0.2);
        } catch {
          // already stopped
        }
      },
    };
    live.push(h);
    o.onended = () => {
      live = live.filter((x) => x !== h);
    };
  };

  return {
    click(at, accent) {
      tone(
        "sine",
        accent ? 1760 : 1320,
        at,
        accent ? LEVEL.accent : LEVEL.click,
        0.002,
        0.01,
        0.05,
        8000,
      );
    },
    chord(chord, at, seconds) {
      CHORD_MIDI[chord].forEach((m) =>
        [-7, 7].forEach((cents) =>
          tone(
            "sawtooth",
            hz(m),
            at,
            LEVEL.pad / 2,
            0.3,
            Math.max(0.1, seconds - 0.35),
            0.45,
            800,
            cents,
          ),
        ),
      );
    },
    ding(midi, at) {
      tone("sine", hz(midi + 24), at, LEVEL.ding, 0.004, 0.02, 0.7, 7000);
      tone(
        "sine",
        hz(midi + 31),
        at + 0.06,
        LEVEL.ding * 0.6,
        0.004,
        0.02,
        0.6,
        7000,
      );
    },
    chime(at) {
      [84, 88, 91, 96].forEach((m, i) =>
        tone("sine", hz(m), at + i * 0.09, LEVEL.chime, 0.005, 0.05, 0.9, 6000),
      );
    },
    cut(now) {
      live.forEach((h) => h.stop(now));
      live = [];
    },
  };
};
