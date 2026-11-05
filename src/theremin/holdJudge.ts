// Is a note in tune, and has it been held long enough (Learn)? Plain code.

/** Learn: in tune within this (cents), this loud, held this long (s). */
export const LEARN = { cents: 40, volume: 0.2, hold: 0.4 };
/** How far `midi` is from `target` (cents, always ≥ 0). */
export const centsBetween = (midi: number, target: number) =>
  Math.abs(midi - target) * 100;

/** Is this pitch in tune with `target`, within `cents`? */
export const inTune = (midi: number, target: number, cents: number) =>
  centsBetween(midi, target) <= cents;

/**
 * Learn's judge for one note: in tune and loud enough, held long enough.
 * Returns true once it counts.
 */
export class HoldJudge {
  held = 0;

  push(dt: number, midi: number, volume: number, target: number) {
    if (volume > LEARN.volume && inTune(midi, target, LEARN.cents))
      this.held += dt;
    else this.held = 0;
    return this.held >= LEARN.hold;
  }

  reset() {
    this.held = 0;
  }
}
