// Development only: window.__theremin, a look inside for testing without a
// camera — the state, the sound meter, and controls:
//
//   __theremin.play(0.5, 0.7)      pitch 0..1, volume 0..1 (held until release)
//   __theremin.release()           the sound fades out
//   __theremin.mode("free")        "free" or "scale"
//   __theremin.view("player"), __theremin.night(true)
//   __theremin.look([x, y, z], [tx, ty, tz], fov)   a fixed camera (null: back)
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { meter, sound } from "./audio";
import { cameraOverride } from "./CameraRig";
import type { View } from "./layout";
import type { PitchMode } from "./pitch";
import { rig } from "./Theremin";
import { play, release, setMode, setNight, setView, theremin } from "./state";

const DevDebug = () => {
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const api = {
      theremin,
      rig,
      camera,
      scene,
      meter,
      sound,
      /** The output's level and low end right now. */
      levels: () => ({ ...sound.last }),
      play: (pitch = 0.5, volume = 0.7) => play(pitch, volume, "pointer"),
      release: () => release("pointer"),
      mode: (m: PitchMode) => setMode(m),
      view: (v: View) => setView(v),
      night: (on: boolean) => setNight(on),
      look(pos: number[] | null, target: number[] = [0, 1.1, -0.3], fov = 40) {
        cameraOverride.pose = pos
          ? { pos: new Vector3(...pos), target: new Vector3(...target), fov }
          : null;
      },
    };
    (window as unknown as { __theremin?: typeof api }).__theremin = api;
    return () => {
      delete (window as unknown as { __theremin?: typeof api }).__theremin;
    };
  }, [camera, scene]);
  return null;
};

export default DevDebug;
