// Songs: learning and playing along.
//
// Learn waits for you at each note: the note card shows it, its tick on the
// corner camera's ruler glows gold, and a gold ring round the antenna shows
// where the teal rings must close to. It counts once you hold it in tune for
// a moment (a soft chime). Play runs the song at its tempo (or slower) after
// a one-bar count-in, with a quiet pad on the chords, and judges each note
// by how much of it you played in tune; at the end, one to three stars.
// Starting a song switches the pitch to Scale. Esc, or the dock's stop
// button, ends the song and free play carries on.
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";

import { sound } from "./audio";
import { makeBacking, type Backing } from "./backing";
import { COUNT_IN_BARS, Session, type SongMode } from "./session";
import { songById } from "./songs";
import { setMode, theremin } from "./state";

/** Play's slower speed. */
export const SLOW = 0.75;
/** How far ahead (s) the backing is scheduled. */
const LOOKAHEAD = 0.2;

const player = {
  backing: null as Backing | null,
  /** The next count-in beat and bar to schedule. */
  click: 0,
  bar: 0,
};

/** Each song's best stars (Play), kept on this device. */
const BEST_KEY = "theremin.best";
export const bestStars = (): Record<string, number> => {
  try {
    return JSON.parse(window.localStorage.getItem(BEST_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
};
const saveBest = (id: string, stars: number) => {
  try {
    const best = bestStars();
    if ((best[id] ?? 0) >= stars) return;
    best[id] = stars;
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // private mode: not remembered
  }
};

/** Starts a song (from a tap: it also starts the sound). */
export const startSong = (id: string, mode: SongMode) => {
  const song = songById(id);
  sound.unlock();
  const a = sound.audio();
  if (!song || !a) return;
  player.backing?.cut(a.ctx.currentTime);
  player.backing ??= makeBacking(a.ctx, a.master);
  setMode("scale");
  theremin.session = new Session(
    song,
    mode,
    theremin.slow ? SLOW : 1,
    a.ctx.currentTime + 0.1,
  );
  player.click = 0;
  player.bar = 0;
  theremin.target = song.notes[0].midi;
  theremin.songCard = false;
  theremin.howTo = false;
  theremin.howToUntil = null;
  theremin.finish = null;
  theremin.changed();
};

/** Ends the song (free play carries on). */
export const stopSong = () => {
  const a = sound.audio();
  player.backing?.cut(a?.ctx.currentTime ?? 0);
  if (!theremin.session && theremin.target === null) return;
  theremin.session = null;
  theremin.target = null;
  theremin.changed();
};

/** The finish card goes (or a new song starts). */
export const closeFinish = () => {
  theremin.finish = null;
  theremin.changed();
};

export const SongPlayer = () => {
  // Esc ends the song, or closes the songs card or the finish card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (theremin.session) stopSong();
      else if (theremin.songCard || theremin.finish) {
        theremin.songCard = false;
        theremin.finish = null;
        theremin.changed();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => () => stopSong(), []);

  useFrame(() => {
    const s = theremin.session;
    const a = sound.audio();
    if (!s || !a) return;
    const now = a.ctx.currentTime;
    s.update(now, theremin.midi, theremin.volume);

    // Play: the count-in clicks and the pad's chords, a little ahead.
    if (s.mode === "play" && player.backing) {
      const bpb = s.song.beatsPerBar;
      const count = COUNT_IN_BARS * bpb;
      while (player.click < count) {
        const at = s.timeOf(player.click - count);
        if (at > now + LOOKAHEAD) break;
        player.backing.click(Math.max(now, at), player.click % bpb === 0);
        player.click += 1;
      }
      while (player.bar < s.song.chords.length) {
        const at = s.timeOf(player.bar * bpb);
        if (at > now + LOOKAHEAD) break;
        player.backing.chord(
          s.song.chords[player.bar],
          Math.max(now, at),
          bpb * s.secondsPerBeat,
        );
        player.bar += 1;
      }
    }

    // A note that counts glows (Learn: a soft chime too).
    const t = performance.now();
    s.events.forEach((e) => {
      if (e.kind === "miss") return;
      theremin.fx.goodAt = t;
      theremin.fx.goodSeq += 1;
      theremin.fx.perfect = e.kind === "perfect";
      if (s.mode === "learn")
        player.backing?.ding(s.song.notes[e.index].midi, now);
    });
    let dirty = s.events.length > 0;
    s.events = [];

    // The note to play now.
    const i = s.current(now);
    const target = i < s.song.notes.length ? s.song.notes[i].midi : null;
    if (target !== theremin.target) {
      theremin.target = target;
      dirty = true;
    }

    if (s.done) {
      const stars = s.mode === "play" ? s.stars : 3;
      if (s.mode === "play") saveBest(s.song.id, stars);
      player.backing?.chime(now + 0.05);
      theremin.finish = { id: s.song.id, mode: s.mode, stars, at: t };
      theremin.session = null;
      theremin.target = null;
      dirty = true;
    }
    if (dirty) theremin.changed();
  });

  return null;
};
