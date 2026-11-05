// A song being learnt or played (pure: times in seconds on the audio clock).
//
// Each moment the caller says what sounds: the pitch (MIDI, fractional) and
// the volume (0..1).
//
// Learn waits for you: a note counts once you hold it in tune (within
// ±40 cents) and loud enough for a moment (a repeated note: hold it again).
// No timing, nothing to fail.
//
// Play runs at the song's tempo (or slower) after a one-bar count-in. Each
// note is judged by the share of its length you sound it in tune (within
// ±50 cents), with a little room either side for the hands' delay:
// perfect, good, or missed.
import { HoldJudge, inTune } from "./holdJudge";
import { noteStarts, secondsPerBeat, songBeats, type Song } from "./songs";

export { centsBetween, HoldJudge, inTune, LEARN } from "./holdJudge";

export type SongMode = "learn" | "play";
export type Judgement = "perfect" | "good" | "miss";

export type SessionEvent = { kind: Judgement; index: number; at: number };

/** Play: in tune within this (cents), and sounding at least this loud. */
export const PLAY = { cents: 50, volume: 0.1 };
/**
 * Play: a note's window opens this early and closes this late (s) round its
 * length; the share of its length in tune makes it perfect or good.
 */
export const WINDOW = { early: 0.12, late: 0.2, perfect: 0.7, good: 0.4 };
/** The count-in before the first bar (bars). */
export const COUNT_IN_BARS = 1;

/** How a note sounded in tune for this share of its length is judged. */
export const judgeShare = (share: number): Judgement => {
  if (share >= WINDOW.perfect) return "perfect";
  if (share >= WINDOW.good) return "good";
  return "miss";
};

const POINTS: Record<Judgement, number> = { perfect: 1, good: 0.6, miss: 0 };

/** Stars for a finished song (1–3), from how well its notes were played. */
export const starsFor = (results: readonly (Judgement | null)[]) => {
  const count = results.length || 1;
  const score =
    results.reduce((sum, r) => sum + (r ? POINTS[r] : 0), 0) / count;
  if (score >= 0.8) return 3;
  if (score >= 0.5) return 2;
  return 1;
};

export class Session {
  readonly song: Song;

  readonly mode: SongMode;

  readonly speed: number;

  /** Each note's result (Learn: "good" once played). */
  readonly results: (Judgement | null)[];

  /** Learn: the next note to play. Play: the earliest note not yet judged. */
  next = 0;

  done = false;

  /** Events not yet shown (the caller drains them). */
  events: SessionEvent[] = [];

  /** Each note's start (beats from the first bar). */
  readonly starts: number[];

  /** Play: the audio time of the first bar's downbeat. */
  readonly t0: number;

  /** Play: how long each note sounded in tune (s). */
  readonly right: number[];

  private readonly spb: number;

  private last: number;

  private readonly judge = new HoldJudge();

  constructor(song: Song, mode: SongMode, speed: number, now: number) {
    this.song = song;
    this.mode = mode;
    this.speed = mode === "learn" ? 1 : speed;
    this.spb = secondsPerBeat(song, this.speed);
    this.results = song.notes.map(() => null);
    this.right = song.notes.map(() => 0);
    this.starts = noteStarts(song);
    this.t0 = now + COUNT_IN_BARS * song.beatsPerBar * this.spb;
    this.last = now;
  }

  get secondsPerBeat() {
    return this.spb;
  }

  /** The audio time of a beat (Play). */
  timeOf(beat: number) {
    return this.t0 + beat * this.spb;
  }

  /** Play: the song's position (beats from the first bar; < 0 in the count-in). */
  beatAt(now: number) {
    return (now - this.t0) / this.spb;
  }

  /** The note to play now (Learn: the next; Play: the one under the beat, or the next one coming). */
  current(now: number): number {
    if (this.mode === "learn") return this.next;
    const b = this.beatAt(now);
    for (let i = this.next; i < this.starts.length; i += 1)
      if (b < this.starts[i] + this.song.notes[i].beats) return i;
    return this.starts.length;
  }

  /** How far through the song (0..1). */
  progress(now: number) {
    if (this.mode === "learn") return this.next / this.song.notes.length;
    return Math.min(1, Math.max(0, this.beatAt(now) / songBeats(this.song)));
  }

  /** Moves on to `now`, with the pitch (MIDI) and volume (0..1) sounding. */
  update(now: number, midi: number, volume: number) {
    const dt = Math.max(0, Math.min(0.5, now - this.last));
    this.last = now;
    if (this.done) return;
    if (this.mode === "learn") this.learn(now, dt, midi, volume);
    else this.play(now, dt, midi, volume);
  }

  get stars() {
    return starsFor(this.results);
  }

  private learn(now: number, dt: number, midi: number, volume: number) {
    const { notes } = this.song;
    const target = notes[this.next];
    if (!target) {
      this.done = true;
      return;
    }
    if (this.judge.push(dt, midi, volume, target.midi)) {
      this.results[this.next] = "good";
      this.events.push({ kind: "good", index: this.next, at: now });
      this.next += 1;
      this.judge.reset();
      if (this.next >= notes.length) this.done = true;
    }
  }

  private play(now: number, dt: number, midi: number, volume: number) {
    const { notes } = this.song;
    const sounding = volume > PLAY.volume;
    // Sounding in tune fills every open window of that note.
    if (sounding)
      for (let i = this.next; i < notes.length; i += 1) {
        const open = this.timeOf(this.starts[i]) - WINDOW.early;
        if (now < open) break;
        const close =
          this.timeOf(this.starts[i] + notes[i].beats) + WINDOW.late;
        if (now <= close && inTune(midi, notes[i].midi, PLAY.cents))
          this.right[i] += dt;
      }
    // Notes whose window has closed are judged.
    while (this.next < notes.length) {
      const i = this.next;
      const close = this.timeOf(this.starts[i] + notes[i].beats) + WINDOW.late;
      if (now <= close) break;
      const share = Math.min(1, this.right[i] / (notes[i].beats * this.spb));
      const result = judgeShare(share);
      this.results[i] = result;
      this.events.push({ kind: result, index: i, at: now });
      this.next += 1;
    }
    if (this.next >= notes.length) this.done = true;
  }
}
