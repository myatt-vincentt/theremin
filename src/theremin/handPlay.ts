// Playing with your hands, read from where your palms are on the camera
// picture (as you see it: a mirrored selfie, your right hand on the right).
// Plain code (no scene).
//
//   pitch hand   across the picture: further right (towards the antenna's
//                side) is higher. The play zone runs from about 45 % to 95 %
//                of the width over C4 … C6, and widens if you reach past it.
//                Smoothed just enough to take out the tracker's jitter while
//                keeping your wrist's own tremble (a real vibrato).
//   volume hand  up the picture: higher is louder, over a zone from 85 % of
//                the height (silent below) up to 25 % (full), on a gentle
//                curve. A fist held for a moment mutes quickly.
//   lost hands   a lost pitch hand holds its pitch and fades out; a lost
//                volume hand fades to silent. With only the pitch hand in
//                view it plays at a medium volume (ONE_HAND), so one hand is
//                enough to play.

import { OneEuro } from "./oneEuro";
import { PitchZone } from "./pitchZone";

export { OneEuro } from "./oneEuro";
export { PITCH_ZONE, PitchZone, ZONE_WIDEN } from "./pitchZone";

/** A palm on the picture: 0..1 across from the left, 0..1 down from the top. */
export type Palm = { x: number; y: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------- the zones

/** The volume zone up the picture: silent at `bottom` (and below), full at `top`; the curve's power. */
export const VOLUME_ZONE = { bottom: 0.85, top: 0.25, curve: 1.35 };

/** The volume (0..1) of a palm at height `y` (0 top … 1 bottom of the picture). */
export const volumeOf = (y: number) => {
  const t = clamp01(
    (VOLUME_ZONE.bottom - y) / (VOLUME_ZONE.bottom - VOLUME_ZONE.top),
  );
  return t ** VOLUME_ZONE.curve;
};

// ---------------------------------------------------------------- the player

/** A lost hand fades over this long (s). */
export const FADE = 0.3;
/** A fist must hold this long to mute (s); muting then takes this long (s). */
export const FIST = { hold: 0.12, fade: 0.06 };
/**
 * One-hand play: with only the pitch hand in view (no volume hand for
 * `after` s, and the pitch hand in view as long), it plays at `volume`,
 * rising over `rise` s. A volume hand lost mid-play fades to silent first. Set `on` to false
 * to need both hands.
 */
export const ONE_HAND = { on: true, volume: 0.55, after: 0.6, rise: 0.3 };

export type HandsIn = {
  /** Seconds (the tracker's clock). */
  t: number;
  /** The pitch hand's palm, or null when it is not in view. */
  pitch: Palm | null;
  /** The volume hand's palm, or null; and whether it makes a fist. */
  volume: Palm | null;
  fist: boolean;
};

export type HandsOut = {
  /** The pitch (0..1) and the volume (0..1) to play. */
  pitch: number;
  volume: number;
  /** Either hand is in view, or a lost one is still fading out. */
  active: boolean;
  /** The volume hand mutes (a fist). */
  muted: boolean;
  /** Playing on the pitch hand alone. */
  oneHand: boolean;
  /** The volume the volume hand asks for (before fades), for the overlay. */
  level: number;
};

/** Moves `v` towards `to` at a rate that covers 0..1 in `time` s. */
const approach = (v: number, to: number, time: number, dt: number) => {
  const step = time <= 0 ? 1 : dt / time;
  return v < to ? Math.min(to, v + step) : Math.max(to, v - step);
};

/** Follows both hands over time and gives the pitch and volume to play. */
export class HandPlayer {
  readonly zone = new PitchZone();

  private readonly filter = new OneEuro();

  private pitch = 0.5;

  private volume = 0;

  private t: number | null = null;

  private fistSince: number | null = null;

  private volumeSeen = -1e9;

  /** When the pitch hand came into view (null: not in view). */
  private pitchSince: number | null = null;

  private oneHand = false;

  private level = 0;

  readonly out: HandsOut = {
    pitch: 0.5,
    volume: 0,
    active: false,
    muted: false,
    oneHand: false,
    level: 0,
  };

  update(input: HandsIn): HandsOut {
    const { t } = input;
    const dt = this.t === null ? 0 : Math.max(0, Math.min(0.25, t - this.t));
    this.t = t;

    // The pitch hand: where it is (a lost one holds its pitch).
    if (input.pitch) {
      if (this.pitchSince === null) this.pitchSince = t;
      const x = this.filter.push(t, input.pitch.x);
      this.zone.push(x, dt);
      this.pitch = this.zone.pitch(x);
    } else {
      this.filter.reset();
      this.pitchSince = null;
    }

    // The volume hand: its height, or a fist (held a moment) to mute.
    let muted = false;
    if (input.volume) {
      this.volumeSeen = t;
      if (input.fist) {
        if (this.fistSince === null) this.fistSince = t;
      } else this.fistSince = null;
      muted = this.fistSince !== null && t - this.fistSince >= FIST.hold;
      this.level = volumeOf(input.volume.y);
    } else this.fistSince = null;

    // What the volume should be, and how fast it gets there.
    let want = 0;
    let time = FADE;
    this.oneHand = false;
    if (!input.pitch) want = 0;
    else if (input.volume) {
      if (muted) {
        want = 0;
        time = FIST.fade;
      } else {
        want = this.level;
        time = 0;
      }
    } else if (
      ONE_HAND.on &&
      t - this.volumeSeen >= ONE_HAND.after &&
      this.pitchSince !== null &&
      t - this.pitchSince >= ONE_HAND.after
    ) {
      this.oneHand = true;
      want = ONE_HAND.volume;
      time = ONE_HAND.rise;
    }
    this.volume = approach(this.volume, want, time, dt);

    const o = this.out;
    o.pitch = this.pitch;
    o.volume = this.volume;
    o.muted = muted;
    o.oneHand = this.oneHand;
    o.level = input.volume ? this.level : 0;
    o.active = !!input.pitch || !!input.volume || this.volume > 0;
    return o;
  }

  /** The tracker has stopped: start afresh. */
  reset() {
    this.filter.reset();
    this.zone.reset();
    this.volume = 0;
    this.t = null;
    this.fistSince = null;
    this.volumeSeen = -1e9;
    this.pitchSince = null;
  }
}
