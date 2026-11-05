// Development only: window.__theremin, a look inside for testing without a
// camera — the state, the sound meter, and controls:
//
//   __theremin.play(0.5, 0.7)      pitch 0..1, volume 0..1 (held until release)
//   __theremin.release()           the sound fades out
//   __theremin.mode("free")        "free" or "scale"
//   __theremin.view("player"), __theremin.night(true)
//   __theremin.look([x, y, z], [tx, ty, tz], fov)   a fixed camera (null: back)
//
// With ?debug in the address, a small readout at the top left shows
// both hands, the pitch (Hz and note), the volume, the pitch zone and the
// mute (to see what a webcam does).
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { meter, sound } from "./audio";
import { hands } from "./Hands";
import { cameraOverride } from "./CameraRig";
import type { View } from "./layout";
import type { PitchMode } from "./pitch";
import { rig } from "./Theremin";
import { play, release, setMode, setNight, setView, theremin } from "./state";

/** The ?debug readout: a plain text box, refreshed a few times a second. */
const useReadout = () => {
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug"))
      return undefined;
    const box = document.createElement("pre");
    Object.assign(box.style, {
      position: "fixed",
      left: "8px",
      top: "64px",
      zIndex: "60",
      margin: "0",
      padding: "8px 10px",
      borderRadius: "10px",
      background: "rgb(0 0 0 / .7)",
      color: "#fff",
      font: "11px/1.4 ui-monospace, monospace",
      pointerEvents: "none",
    });
    document.body.appendChild(box);
    const yes = (b: boolean) => (b ? "yes" : "no");
    const palm = (p: { x: number; y: number } | null) =>
      p ? `${p.x.toFixed(2)}, ${p.y.toFixed(2)}` : "-";
    const t = window.setInterval(() => {
      box.textContent = [
        `mode ${theremin.mode}  by ${theremin.by}`,
        `pitch hand ${yes(hands.pitchTracked)}  palm ${palm(hands.pitchPalm)}`,
        `volume hand ${yes(hands.volumeTracked)}  palm ${palm(hands.volumePalm)}  fist ${yes(hands.fist)}`,
        `pitch ${meter.hz.toFixed(1)} Hz  ${theremin.note}  (${theremin.pitch.toFixed(2)})`,
        `volume ${theremin.volume.toFixed(2)}  hand asks ${hands.level.toFixed(2)}  one hand ${yes(hands.oneHand)}`,
        `zone ${hands.zone.lo.toFixed(2)} … ${hands.zone.hi.toFixed(2)}  mute ${yes(hands.muted)}`,
        `sound ${sound.unlocked ? "on" : "off"}  level ${sound.last.level.toFixed(2)}  vibrato ${meter.vibrato.toFixed(1)} c`,
      ].join("\n");
    }, 200);
    return () => {
      window.clearInterval(t);
      box.remove();
    };
  }, []);
};

const DevDebug = () => {
  useReadout();
  const camera = useThree((st) => st.camera);
  const scene = useThree((st) => st.scene);
  useEffect(() => {
    const api = {
      theremin,
      /** What the hand reading sees. */
      hands,
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
