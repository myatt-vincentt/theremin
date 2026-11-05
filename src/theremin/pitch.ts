// The theremin's two values and how they become sound. Plain code (no scene).
//
//   pitch   0 (hand far from the antenna) … 1 (hand at the antenna): two
//           octaves, C4 … C6, even in semitones (a step is the same size
//           everywhere along the range)
//   volume  0 (hand flat on the loop: silent) … 1 (hand high over it)
//
// Two ways to play the pitch: Free glides through every pitch in between;
// Scale snaps gently to the notes of C major, so a tune comes out in tune.

export type PitchMode = "free" | "scale";
export const PITCH_MODES: PitchMode[] = ["free", "scale"];
export const PITCH_MODE_LABEL: Record<PitchMode, string> = {
  free: "Free",
  scale: "Scale",
};

/** The range: C4 … C6 (MIDI note numbers). */
export const LOW_MIDI = 60;
export const HIGH_MIDI = 84;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pitch 0..1 → MIDI note (fractional: between the notes is allowed). */
export const pitchToMidi = (pitch: number) =>
  LOW_MIDI + (HIGH_MIDI - LOW_MIDI) * clamp01(pitch);

/** MIDI note → pitch 0..1 (outside the range is clamped). */
export const midiToPitch = (midi: number) =>
  clamp01((midi - LOW_MIDI) / (HIGH_MIDI - LOW_MIDI));

/** MIDI note → frequency (Hz), A4 = 440. */
export const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** The notes of C major within one octave (semitones above C). */
const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** The C major notes in the range, low to high (C4 … C6: 15 notes). */
export const SCALE_NOTES: number[] = (() => {
  const out: number[] = [];
  for (let m = LOW_MIDI; m <= HIGH_MIDI; m += 1)
    if (C_MAJOR.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
})();

/** The C major note nearest to `midi` (a tie goes to the lower note). */
export const nearestScaleNote = (midi: number) => {
  let best = SCALE_NOTES[0];
  SCALE_NOTES.forEach((n) => {
    if (Math.abs(n - midi) < Math.abs(best - midi) - 1e-9) best = n;
  });
  return best;
};

/**
 * How far past the half-way point between two notes the hand must go before
 * Scale lets go of the note it holds (semitones): a hand resting on the
 * border does not flicker between the two.
 */
export const SNAP_HOLD = 0.2;

/**
 * Scale: the note to sound for a hand at `midi`, holding `held` (the note
 * sounding now, or null) until the hand is clearly nearer another.
 */
export const snapToScale = (midi: number, held: number | null = null) => {
  const near = nearestScaleNote(midi);
  if (held === null || near === held || !SCALE_NOTES.includes(held))
    return near;
  // Keep the held note while the hand is still within its border (plus the hold).
  const border = Math.abs(near - held) / 2;
  if (Math.abs(midi - held) <= border + SNAP_HOLD) return held;
  return near;
};

/** The pitch to sound in this mode (MIDI, fractional in Free). */
export const targetMidi = (
  pitch: number,
  mode: PitchMode,
  held: number | null = null,
) => {
  const m = pitchToMidi(pitch);
  return mode === "scale" ? snapToScale(m, held) : m;
};

/**
 * Pitch glide (portamento): the time constant (s) the sounding pitch follows
 * the hand with. Free: smooth, as a real theremin. Scale: a short glide from
 * note to note.
 */
export const GLIDE: Record<PitchMode, number> = { free: 0.045, scale: 0.03 };

const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** The nearest note's name with its octave, e.g. 69 → "A4". */
export const noteName = (midi: number) => {
  const n = Math.round(midi);
  return `${NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
};

/** How far `midi` is from its nearest note (cents, −50 … +50). */
export const centsOff = (midi: number) =>
  Math.round((midi - Math.round(midi)) * 100);

/** The keys A S D F G H J K play C D E F G A B C (C4 … C5). */
export const KEY_NOTES: Record<string, number> = {
  KeyA: 60,
  KeyS: 62,
  KeyD: 64,
  KeyF: 65,
  KeyG: 67,
  KeyH: 69,
  KeyJ: 71,
  KeyK: 72,
};

/** A key's volume to start with, and its step with ↑ ↓. */
export const KEY_VOLUME = { start: 0.6, step: 0.1, min: 0.1, max: 1 };

/**
 * Volume 0..1 → the amplitude sent out (0..1). Loudness follows the hand
 * evenly to the ear (a power curve); 0 is exactly silent.
 */
export const volumeToGain = (volume: number) => {
  const v = clamp01(volume);
  return v <= 0 ? 0 : v ** 1.7;
};

/**
 * The pitch's colour (a hue, 0..1) for the lights: low notes teal, through
 * blue and violet, to warm gold at the top.
 */
export const pitchHue = (pitch: number) => (0.48 + 0.6 * clamp01(pitch)) % 1;

/**
 * Mouse and touch: a point on the screen (0..1 across from the left, 0..1
 * down from the top) → pitch and volume. Across towards the antenna's side
 * is higher (`antennaLeft`: the antenna is on the left of the picture); up is
 * louder. The outer edges are a margin, so the ends are easy to reach.
 */
export const DRAG_MARGIN = { x: 0.1, y: 0.12 };
export const screenToPlay = (x: number, y: number, antennaLeft: boolean) => {
  const across = clamp01((x - DRAG_MARGIN.x) / (1 - 2 * DRAG_MARGIN.x));
  const up = clamp01(1 - (y - DRAG_MARGIN.y) / (1 - 2 * DRAG_MARGIN.y));
  return { pitch: antennaLeft ? 1 - across : across, volume: up };
};
