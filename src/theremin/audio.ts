// The theremin's voice, made in code (Web Audio, no recordings). A real
// theremin is very nearly a pure tone, so this is one warm sine with a
// little of its 2nd and 3rd harmonics, a soft natural vibrato that grows as
// a note is held, a glide between pitches, a small room and a gentle limiter.
// Loudness always moves smoothly (a soft attack and release, never a click),
// and volume 0 is truly silent. A meter the studio's lights move with.
// Silent until Start (browsers only start audio on a tap).
//
//   tone (+ vibrato) → tone filter → loudness → dry + room → limiter → speakers
import { GLIDE, midiToHz, type PitchMode } from "./pitch";

const MASTER = 0.42;
/** The tone's harmonics (amplitude of the 1st, 2nd, 3rd, 4th). */
const HARMONICS = [1, 0.12, 0.06, 0.015];
/** The room's echo: its length (s), how fast it dies, how much of it is heard. */
const ROOM = { length: 1.8, decay: 3.2, wet: 0.16 };
/**
 * Vibrato: its speed (Hz), its depth when the pitch moves and when a note is
 * held (cents), and how long a note must be held before it grows (s): it
 * swells over `grow` s after `wait`.
 */
const VIBRATO = { rate: 5.6, moving: 3, held: 16, wait: 0.25, grow: 1.2 };
/** The pitch counts as held while it moves less than this (semitones / s). */
const STILL = 1.5;
/** Loudness: attack and release time constants (s). */
const ENVELOPE = { attack: 0.03, release: 0.07 };
/** Below this the loudness is set to exactly zero. */
const SILENT = 1e-4;
/** The meter: rise fast, fall back over this long (s). */
const METER_FALL = 0.16;

let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let amp: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let depth: GainNode | null = null;
/** Where the voice (and the song backing) go: the room and the limiter follow. */
let master: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let wave: Float32Array | null = null;
let bins: Uint8Array | null = null;
let unlocked = false;

/** The voice's own state, between frames. */
const voice = {
  /** The pitch it glides to (MIDI), and its last value (for "held"). */
  midi: 72,
  lastMidi: 72,
  /** How long the pitch has been held still (s). */
  heldFor: 0,
  /** The loudness it is heading to (0..1 amplitude) and whether it is silent. */
  gain: 0,
  silent: true,
  /** Vibrato depth now (cents). */
  vibrato: VIBRATO.moving,
};

/** What the studio's lights and speakers show: level and the low end (0..1, eased). */
const out = { level: 0, low: 0 };

/** What has been played (read by the development debug object). */
export const meter = {
  unlocked: false,
  /** The loudest sample sent out so far (1 = full scale). */
  peak: 0,
  /** The pitch sounding now (Hz) and the vibrato (cents). */
  hz: 0,
  vibrato: 0,
};

/** A small room's echo: noise dying away, a little darker as it fades. */
const roomImpulse = (c: AudioContext) => {
  const n = Math.round(c.sampleRate * ROOM.length);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / n;
      const k = 0.25 + 0.6 * (1 - t);
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * (1 - t) ** ROOM.decay;
    }
  }
  return ir;
};

const makeContext = () => {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const c = new AC({ latencyHint: "interactive" });

  // The tone: a sine with a touch of its harmonics.
  osc = c.createOscillator();
  const real = new Float32Array(HARMONICS.length + 1);
  const imag = new Float32Array(HARMONICS.length + 1);
  HARMONICS.forEach((a, i) => {
    imag[i + 1] = a;
  });
  osc.setPeriodicWave(c.createPeriodicWave(real, imag));
  osc.frequency.value = midiToHz(voice.midi);

  // The vibrato moves the pitch (in cents).
  lfo = c.createOscillator();
  lfo.frequency.value = VIBRATO.rate;
  depth = c.createGain();
  depth.gain.value = VIBRATO.moving;
  lfo.connect(depth).connect(osc.detune);

  // A gentle tone filter keeps the top warm.
  const tone = c.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3800;
  tone.Q.value = 0.5;

  amp = c.createGain();
  amp.gain.value = 0;
  master = c.createGain();
  master.gain.value = MASTER;
  osc.connect(tone).connect(amp).connect(master);

  const sum = c.createGain();
  const room = c.createConvolver();
  room.buffer = roomImpulse(c);
  const wet = c.createGain();
  wet.gain.value = ROOM.wet;
  master.connect(sum);
  master.connect(room).connect(wet).connect(sum);

  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 6;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.25;
  analyser = c.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0;
  wave = new Float32Array(analyser.fftSize);
  bins = new Uint8Array(analyser.frequencyBinCount);
  sum.connect(limiter).connect(analyser).connect(c.destination);

  osc.start();
  lfo.start();
  return c;
};

export const sound = {
  /** Sets up the sound (no sound yet). */
  preload() {
    if (ctx) return;
    ctx = makeContext();
  },

  /** Start: the browser lets the sound play from here on. */
  unlock() {
    if (!ctx) this.preload();
    if (!ctx) return;
    // Play through the phone's silent switch, like a music app.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      // not supported
    }
    if (ctx.state !== "running") void ctx.resume();
    unlocked = true;
    meter.unlocked = true;
  },

  get unlocked() {
    return unlocked;
  },

  /** The audio clock and the output a backing joins (null before the sound is on). */
  audio() {
    return ctx && master && unlocked ? { ctx, master } : null;
  },

  /**
   * Once a frame: the pitch to sound (MIDI), its loudness (0..1 amplitude),
   * and the pitch mode (its glide).
   */
  update(midi: number, gain: number, mode: PitchMode, dt: number) {
    const v = voice;
    const step = Math.max(1e-3, dt);
    const speed = Math.abs(midi - v.lastMidi) / step;
    v.lastMidi = midi;
    v.heldFor = speed < STILL ? v.heldFor + dt : 0;
    const grow = Math.min(
      1,
      Math.max(0, (v.heldFor - VIBRATO.wait) / VIBRATO.grow),
    );
    const want =
      VIBRATO.moving +
      (VIBRATO.held - VIBRATO.moving) * grow * grow * (3 - 2 * grow);
    v.vibrato += (want - v.vibrato) * (1 - Math.exp(-dt / 0.25));
    meter.vibrato = v.vibrato;
    if (!ctx || !osc || !amp || !depth || !lfo) return;
    const now = ctx.currentTime;
    // Glide to the new pitch (a new note out of silence starts on it).
    const hz = midiToHz(midi);
    meter.hz = hz;
    if (v.silent && gain > 0) {
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(hz, now);
    } else osc.frequency.setTargetAtTime(hz, now, GLIDE[mode]);
    v.midi = midi;
    depth.gain.setTargetAtTime(v.vibrato, now, 0.05);
    // A little life in the vibrato's speed.
    lfo.frequency.setTargetAtTime(
      VIBRATO.rate + 0.35 * Math.sin(now * 0.7) + 0.15 * Math.sin(now * 1.9),
      now,
      0.2,
    );
    // Loudness: soft on, soft off, and exactly zero once it has died away.
    const target = unlocked ? Math.max(0, Math.min(1, gain)) : 0;
    if (target !== v.gain || (target === 0 && !v.silent)) {
      const rising = target > amp.gain.value;
      if (target === 0 && amp.gain.value < SILENT) {
        amp.gain.cancelScheduledValues(now);
        amp.gain.setValueAtTime(0, now);
        v.silent = true;
      } else {
        amp.gain.setTargetAtTime(
          target,
          now,
          rising ? ENVELOPE.attack : ENVELOPE.release,
        );
        if (target > 0) v.silent = false;
      }
      v.gain = target;
    }
  },

  /**
   * The output's level and its low end right now, each 0..1: quick to rise,
   * easing back over about 0.16 s. Silent is 0.
   */
  levels(dt: number) {
    if (!analyser || !wave || !bins || !ctx || ctx.state !== "running") {
      out.level = 0;
      out.low = 0;
      return out;
    }
    analyser.getFloatTimeDomainData(wave as Float32Array<ArrayBuffer>);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < wave.length; i += 1) {
      sum += wave[i] * wave[i];
      peak = Math.max(peak, Math.abs(wave[i]));
    }
    meter.peak = Math.max(meter.peak, peak);
    const rms = Math.sqrt(sum / wave.length);
    analyser.getByteFrequencyData(bins as Uint8Array<ArrayBuffer>);
    // The bins below about 300 Hz (the lowest notes).
    const top = Math.max(
      1,
      Math.round((300 / (ctx.sampleRate / 2)) * bins.length),
    );
    let low = 0;
    for (let i = 1; i <= top; i += 1) low = Math.max(low, bins[i] / 255);
    const level = Math.min(1, rms * 2.6);
    const lowNow = Math.max(0, (low - 0.6) / 0.4);
    const fall = Math.exp(-dt / (METER_FALL / 3));
    out.level = level > out.level ? level : out.level * fall;
    out.low = lowNow > out.low ? lowNow : out.low * fall;
    return out;
  },

  /** The levels as last measured (by the studio, once a frame). */
  get last() {
    return out;
  },

  meter,
};
