// What the theremin, the ghost hands, the drag and keys and the page UI
// share. Per-frame values are read and written in the frame loop (never React
// state); the few the page UI shows bump a version it subscribes to.
import { useSyncExternalStore } from "react";

import { sound } from "./audio";
import { VIEWS, type View } from "./layout";
import type { Session, SongMode } from "./session";
import {
  noteName,
  PITCH_MODES,
  targetMidi,
  volumeToGain,
  type PitchMode,
} from "./pitch";

export type PlaySource = "hands" | "pointer" | "keys";
export type Side = "left" | "right";

/** Which of your hands does what: the pitch hand at the antenna, the volume hand over the loop. */
export const HAND: { pitch: Side; volume: Side } = {
  pitch: "right",
  volume: "left",
};

const listeners = new Set<() => void>();
let version = 0;

/** How fast the shown values follow the played ones (1/s). */
const FOLLOW = 18;

export const theremin = {
  /** Screen width ÷ height. */
  aspect: 1,
  /** Free glide or C major snapping. */
  mode: "scale" as PitchMode,

  // What is played (set by the hands, a drag or the keys).
  /** The pitch hand: 0 far from the antenna … 1 at it. */
  pitch: 0.5,
  /** The volume hand: 0 on the loop (silent) … 1 high over it. */
  volume: 0,
  /** Who played last. */
  by: "pointer" as PlaySource,

  // What sounds (and what the scene shows), eased each frame.
  /** The pitch sounding (MIDI) and Scale's held note. */
  midi: 72,
  held: null as number | null,
  /** The shown pitch and volume (0..1), eased: the hands, fields and ribbon follow these. */
  shownPitch: 0.5,
  shownVolume: 0,
  /** The note's name, for the readout (and how far off it is, cents). */
  note: "C5",
  /** performance.now() / 1000 when it last sounded. */
  playedAt: -1e9,

  // What the page UI shows.
  view: "front" as View,
  night: false,
  /** The corner camera is tucked away. */
  camHidden: false,
  /** The studio, the theremin and the hands have loaded. */
  loaded: false,
  /** Start was tapped on the home page (the camera runs). */
  started: false,
  /** The home page has gone (the theremin is in front of you). */
  entered: false,
  /** The "how to play" steps card is open. */
  howTo: false,
  /** It opened right after Start: it closes by itself (performance.now() ms). */
  howToUntil: null as number | null,
  /** After the first card: the dock's one pulse (performance.now() ms). */
  dockPulseAt: null as number | null,

  // Songs.
  /** The songs card is open. */
  songCard: false,
  /** Play runs slower (0.75×). */
  slow: false,
  /** The song being learnt or played (null: free play). */
  session: null as Session | null,
  /** The note to play now in the song (MIDI), or null. */
  target: null as number | null,
  /** A song just finished: its stars (performance.now() ms). */
  finish: null as {
    id: string;
    mode: SongMode;
    stars: number;
    at: number;
  } | null,
  /** The latest note that counted (performance.now() ms; seq to replay). */
  fx: { goodAt: -1e9, goodSeq: 0, perfect: false },
  changed() {
    version += 1;
    listeners.forEach((l) => l());
  },
};

export const nextView = () => {
  theremin.view = VIEWS[(VIEWS.indexOf(theremin.view) + 1) % VIEWS.length];
  theremin.changed();
};

export const setView = (v: View) => {
  theremin.view = v;
  theremin.changed();
};

export const setNight = (on: boolean) => {
  theremin.night = on;
  theremin.changed();
};

export const setMode = (m: PitchMode) => {
  if (theremin.mode === m) return;
  theremin.mode = m;
  theremin.held = null;
  theremin.changed();
};
export const nextMode = () =>
  setMode(PITCH_MODES[(PITCH_MODES.indexOf(theremin.mode) + 1) % 2]);

/** Start on the home page: the sound and the camera. */
export const start = () => {
  if (theremin.started) return;
  sound.unlock();
  theremin.started = true;
  theremin.changed();
};

/** The home page has faded: the steps card shows for a few seconds. */
export const INTRO_CARD_MS = 6000;
export const enter = () => {
  if (theremin.entered) return;
  theremin.entered = true;
  theremin.howTo = true;
  theremin.howToUntil = performance.now() + INTRO_CARD_MS;
  theremin.changed();
};

/** The steps card closes. After the first one the dock pulses once. */
export const closeHowTo = () => {
  if (!theremin.howTo) return;
  const first = theremin.howToUntil !== null;
  theremin.howTo = false;
  theremin.howToUntil = null;
  if (first) theremin.dockPulseAt = performance.now();
  theremin.changed();
};

export const toggleCam = () => {
  theremin.camHidden = !theremin.camHidden;
  theremin.changed();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Re-renders the caller when the page UI's state changes. */
export const useThereminVersion = () =>
  useSyncExternalStore(subscribe, () => version);

/** A hand, a drag or a key plays: pitch and volume, each 0..1. */
export const play = (pitch: number, volume: number, by: PlaySource) => {
  sound.unlock();
  theremin.pitch = Math.min(1, Math.max(0, pitch));
  theremin.volume = Math.min(1, Math.max(0, volume));
  theremin.by = by;
  if (theremin.howTo && by === "hands" && volume > 0.1) closeHowTo();
};

/** The sound fades out (the pitch stays where it was). */
export const release = (by: PlaySource) => {
  theremin.volume = 0;
  theremin.by = by;
};

/**
 * Once a frame: the sound follows what is played, and the shown values
 * follow it too.
 */
export const tick = (dt: number) => {
  const t = theremin;
  const midi = targetMidi(t.pitch, t.mode, t.held);
  t.held = t.mode === "scale" ? midi : null;
  t.midi = midi;
  sound.update(midi, volumeToGain(t.volume), t.mode, dt);
  const k = 1 - Math.exp(-FOLLOW * dt);
  t.shownPitch += (t.pitch - t.shownPitch) * k;
  t.shownVolume += (t.volume - t.shownVolume) * k;
  if (t.volume > 0.02) t.playedAt = performance.now() / 1000;
  const name = noteName(midi);
  if (name !== t.note && t.volume > 0.02) {
    t.note = name;
    t.changed();
  }
};
