// Playing with a mouse, fingers or the computer keyboard, no hands needed:
//   Drag   anywhere on the stage: across is the pitch (towards the antenna's
//          side of the screen is higher), up is louder. Let go and the
//          sound fades out.
//   Keys   A S D F G H J K play C D E F G A B C while held, at a medium
//          volume; ↑ ↓ make it louder or softer.
// Works in every view (the antenna's side follows the view).
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";

import { LOOP, PITCH_AXIS } from "./layout";
import { KEY_NOTES, KEY_VOLUME, midiToPitch, screenToPlay } from "./pitch";
import { play, release, theremin } from "./state";

/** Is this event on a control (the dock, a card, the camera, the media switcher…)? */
const onControl = (e: Event) => {
  const el = e.target as HTMLElement | null;
  return !!el?.closest?.(
    "[data-hud], button, select, input, textarea, a, [role='button']",
  );
};

const antennaMid = PITCH_AXIS.bottom.clone().lerp(PITCH_AXIS.top, 0.4);

/** What the keys hold: the notes pressed (latest last) and their volume. */
export const keys = { held: [] as string[], volume: KEY_VOLUME.start };

export const PointerInput = () => {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const touchWas = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const a = new Vector3();
    const b = new Vector3();
    /** Is the antenna on the left of the picture (seen from this view)? */
    const antennaLeft = () => {
      a.copy(antennaMid).project(camera);
      b.copy(LOOP.center).project(camera);
      return a.x < b.x;
    };
    let dragging: number | null = null;

    const fromPointer = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const p = screenToPlay(
        (e.clientX - r.left) / Math.max(1, r.width),
        (e.clientY - r.top) / Math.max(1, r.height),
        antennaLeft(),
      );
      play(p.pitch, p.volume, "pointer");
    };
    const onDown = (e: PointerEvent) => {
      if (onControl(e) || !theremin.entered || dragging !== null) return;
      dragging = e.pointerId;
      fromPointer(e);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragging) return;
      fromPointer(e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== dragging) return;
      dragging = null;
      if (keys.held.length === 0) release("pointer");
    };

    const playKey = () => {
      const code = keys.held[keys.held.length - 1];
      if (code === undefined) {
        if (dragging === null) release("keys");
        return;
      }
      play(midiToPitch(KEY_NOTES[code]), keys.volume, "keys");
    };
    const typing = (e: KeyboardEvent) =>
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      !!(e.target as HTMLElement | null)?.closest?.("input, textarea, select");
    const onKeyDown = (e: KeyboardEvent) => {
      if (typing(e) || !theremin.entered) return;
      if (KEY_NOTES[e.code] !== undefined) {
        e.preventDefault();
        if (e.repeat) return;
        keys.held = keys.held.filter((k) => k !== e.code);
        keys.held.push(e.code);
        playKey();
        return;
      }
      if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        e.preventDefault();
        const step = e.code === "ArrowUp" ? KEY_VOLUME.step : -KEY_VOLUME.step;
        keys.volume = Math.min(
          KEY_VOLUME.max,
          Math.max(KEY_VOLUME.min, keys.volume + step),
        );
        if (keys.held.length) playKey();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (KEY_NOTES[e.code] === undefined) return;
      if (!keys.held.includes(e.code)) return;
      keys.held = keys.held.filter((k) => k !== e.code);
      playKey();
    };
    // Leaving the page lets go of everything.
    const onBlur = () => {
      keys.held = [];
      dragging = null;
      release("keys");
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      canvas.style.touchAction = touchWas;
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [camera, gl]);

  return null;
};
