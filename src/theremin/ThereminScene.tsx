// Theremin: a theremin in a recording studio, played in the air. Your right
// hand nearer the antenna plays higher; your left hand higher over the loop
// plays louder. Two gold ghost hands play with you; rings around the
// antenna, a halo over the loop and a wave rising from the cabinet show the
// sound. A drag on the stage and the keys play too. Your camera sits small in
// the corner.
//
//   CameraRig.tsx     the views (front, player, close), fitted to the screen (layout.ts)
//   Studio.tsx        the room and its light, day and night; the LEDs glow in the note's colour
//   Theremin.tsx      the theremin, its meter, the pitch rings, the volume halo and the wave
//   GhostHands.tsx    the two gold ghost hands
//   PointerInput.tsx  dragging on the stage, and the keys
//   CameraFrame.tsx   your camera in the corner
//   Hud.tsx           the bottom dock, the note readout, how to play
//   audio.ts          the voice made in code (a warm sine, vibrato, glide, a small room)
//   pitch.ts          pitch and volume: the range, the scale, the note names
//   Home.tsx          the home page (Start), shown over the scene while it loads
import { Suspense, useEffect } from "react";
import { useFrame } from "@react-three/fiber";

import { CameraFrame } from "./CameraFrame";
import { CameraRig } from "./CameraRig";
import { GhostHands } from "./GhostHands";
import { Hud } from "./Hud";
import { PointerInput } from "./PointerInput";
import { theremin, tick, useThereminVersion } from "./state";
import { Studio } from "./Studio";
import { Theremin } from "./Theremin";

/** Mounts once everything above it has loaded (the home page waits for it). */
const Loaded = () => {
  useEffect(() => {
    theremin.loaded = true;
    theremin.changed();
  }, []);
  return null;
};

/** The sound follows what is played, once a frame (before anything is drawn). */
const SoundLoop = () => {
  useFrame((_, dt) => tick(Math.min(dt, 0.1)), -2);
  return null;
};

export const ThereminScene = () => {
  useThereminVersion();
  return (
    <>
      <SoundLoop />
      <CameraRig />
      <Suspense fallback={null}>
        <Studio />
        <Theremin />
        <GhostHands />
        <Loaded />
      </Suspense>
      <CameraFrame />
      <PointerInput />
      <Hud />
    </>
  );
};
