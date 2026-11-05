// The songs to learn and play: four old public-domain tunes in C major,
// within the theremin's range (C4 … C6). Each note is a MIDI note and how
// many beats it lasts; a song may start part-way into its first bar (a
// pickup); each bar has a chord for the backing pad. Plain code (no scene).

export type Chord = "I" | "IV" | "V" | "vi";

export type SongNote = { midi: number; beats: number };

export type Song = {
  id: string;
  title: string;
  bpm: number;
  beatsPerBar: number;
  /** Beats of silence before the first note, in the first bar. */
  pickup: number;
  notes: SongNote[];
  /** One chord per bar (the first bar holds the pickup). */
  chords: Chord[];
};

// The notes by name (octave 4 and 5).
const C4 = 60;
const D4 = 62;
const E4 = 64;
const F4 = 65;
const G4 = 67;
const A4 = 69;
const B4 = 71;
const C5 = 72;
const D5 = 74;
const E5 = 76;
const F5 = 77;
const G5 = 79;

/** Notes written as [midi, beats] pairs. */
const n = (...pairs: Array<[number, number]>): SongNote[] =>
  pairs.map(([midi, beats]) => ({ midi, beats }));

const twinkleA = n(
  [C4, 1],
  [C4, 1],
  [G4, 1],
  [G4, 1],
  [A4, 1],
  [A4, 1],
  [G4, 2],
  [F4, 1],
  [F4, 1],
  [E4, 1],
  [E4, 1],
  [D4, 1],
  [D4, 1],
  [C4, 2],
);
const twinkleB = n(
  [G4, 1],
  [G4, 1],
  [F4, 1],
  [F4, 1],
  [E4, 1],
  [E4, 1],
  [D4, 2],
);

const odeLine = (end: Array<[number, number]>) =>
  n(
    [E5, 1],
    [E5, 1],
    [F5, 1],
    [G5, 1],
    [G5, 1],
    [F5, 1],
    [E5, 1],
    [D5, 1],
    [C5, 1],
    [C5, 1],
    [D5, 1],
    [E5, 1],
    ...end,
  );

export const SONGS: Song[] = [
  {
    id: "twinkle",
    title: "Twinkle Twinkle",
    bpm: 84,
    beatsPerBar: 4,
    pickup: 0,
    notes: [...twinkleA, ...twinkleB, ...twinkleB, ...twinkleA],
    chords: ["I", "IV", "IV", "I", "I", "V", "I", "V", "I", "IV", "IV", "I"],
  },
  {
    id: "ode",
    title: "Ode to Joy",
    bpm: 92,
    beatsPerBar: 4,
    pickup: 0,
    notes: [
      ...odeLine([
        [E5, 1.5],
        [D5, 0.5],
        [D5, 2],
      ]),
      ...odeLine([
        [D5, 1.5],
        [C5, 0.5],
        [C5, 2],
      ]),
    ],
    chords: ["I", "V", "I", "V", "I", "V", "I", "I"],
  },
  {
    id: "grace",
    title: "Amazing Grace",
    bpm: 80,
    beatsPerBar: 3,
    pickup: 2,
    notes: n(
      [G4, 1],
      [C5, 2],
      [E5, 0.5],
      [C5, 0.5],
      [E5, 2],
      [D5, 1],
      [C5, 2],
      [A4, 1],
      [G4, 2],
      [G4, 1],
      [C5, 2],
      [E5, 0.5],
      [C5, 0.5],
      [E5, 2],
      [D5, 1],
      [G5, 2],
      [E5, 1],
      [G5, 2],
      [E5, 0.5],
      [G5, 0.5],
      [E5, 2],
      [D5, 1],
      [C5, 2],
      [A4, 1],
      [G4, 2],
      [G4, 1],
      [C5, 2],
      [E5, 0.5],
      [C5, 0.5],
      [E5, 2],
      [D5, 1],
      [C5, 3],
    ),
    chords: [
      "I",
      "I",
      "I",
      "IV",
      "I",
      "I",
      "V",
      "V",
      "I",
      "I",
      "IV",
      "I",
      "I",
      "V",
      "I",
    ],
  },
  {
    id: "lullaby",
    title: "Brahms' Lullaby",
    bpm: 76,
    beatsPerBar: 3,
    pickup: 2,
    notes: n(
      [E4, 0.5],
      [E4, 0.5],
      [G4, 2],
      [E4, 0.5],
      [E4, 0.5],
      [G4, 2],
      [E4, 0.5],
      [G4, 0.5],
      [C5, 1],
      [B4, 1.5],
      [A4, 0.5],
      [A4, 1],
      [G4, 1],
      [D4, 0.5],
      [E4, 0.5],
      [F4, 1],
      [D4, 1],
      [D4, 0.5],
      [E4, 0.5],
      [F4, 2],
      [D4, 0.5],
      [F4, 0.5],
      [B4, 0.5],
      [A4, 0.5],
      [G4, 1],
      [B4, 1],
      [C5, 2],
      [C4, 0.5],
      [C4, 0.5],
      [C5, 2],
      [A4, 0.5],
      [F4, 0.5],
      [G4, 2],
      [E4, 0.5],
      [C4, 0.5],
      [F4, 1],
      [G4, 1],
      [A4, 1],
      [G4, 2],
      [C4, 0.5],
      [C4, 0.5],
      [C5, 2],
      [A4, 0.5],
      [F4, 0.5],
      [G4, 2],
      [E4, 0.5],
      [C4, 0.5],
      [F4, 1],
      [E4, 1],
      [D4, 1],
      [C4, 3],
    ),
    chords: [
      "I",
      "I",
      "I",
      "IV",
      "V",
      "V",
      "V",
      "V",
      "I",
      "IV",
      "I",
      "IV",
      "I",
      "IV",
      "I",
      "V",
      "I",
    ],
  },
];

export const songById = (id: string) => SONGS.find((s) => s.id === id) ?? null;

/** The song after this one (round to the first). */
export const nextSongId = (id: string) =>
  SONGS[(SONGS.findIndex((s) => s.id === id) + 1) % SONGS.length].id;

/** Seconds per beat at `speed` (1 = the song's tempo). */
export const secondsPerBeat = (song: Song, speed = 1) =>
  60 / (song.bpm * speed);

/** Each note's start (beats from the first bar's downbeat). */
export const noteStarts = (song: Song) => {
  let at = song.pickup;
  return song.notes.map((x) => {
    const s = at;
    at += x.beats;
    return s;
  });
};

/** The song's length (beats, pickup included). */
export const songBeats = (song: Song) =>
  song.notes.reduce((sum, x) => sum + x.beats, song.pickup);

/** Each chord's pad (MIDI, a soft triad below the melody), in C major. */
export const CHORD_MIDI: Record<Chord, number[]> = {
  I: [48, 52, 55],
  IV: [48, 53, 57],
  V: [47, 50, 55],
  vi: [45, 48, 52],
};

/** Do … Ti for each note of C major (by semitones above C). */
const SOLFA: Record<number, string> = {
  0: "Do",
  2: "Re",
  4: "Mi",
  5: "Fa",
  7: "Sol",
  9: "La",
  11: "Ti",
};
export const solfa = (midi: number) =>
  SOLFA[((Math.round(midi) % 12) + 12) % 12] ?? "";
