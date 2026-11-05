// Your two hands, read from the hand tracker every frame (handPlay.ts):
//   - your right hand (the pitch hand) across the picture: further right,
//     towards the antenna's side, is higher
//   - your left hand (the volume hand) up the picture: higher is louder,
//     lower is quieter, and a fist mutes
// A lost hand fades out; the pitch hand alone plays at a medium volume.
// The tracker names hands as they are on your body (left is your left),
// whichever way the camera shows them. While a drag or a key plays, the
// hands wait.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import {
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";

import { fingersUp, isFist, type Joint } from "./fingers";
import { HandPlayer, type Palm } from "./handPlay";
import { pointerPlaying } from "./PointerInput";
import { HAND, play, release, theremin } from "./state";

/** What the ghost hands, the corner camera and the development checks read about your hands. */
export const hands = {
  pitchTracked: false,
  volumeTracked: false,
  /** Each palm on the picture (0..1 across, 0..1 down), while in view. */
  pitchPalm: null as Palm | null,
  volumePalm: null as Palm | null,
  /** The volume hand makes a fist, and it mutes (held a moment). */
  fist: false,
  muted: false,
  /** Playing on the pitch hand alone. */
  oneHand: false,
  /** The volume the volume hand asks for (0..1). */
  level: 0,
  /** The pitch zone across the picture. */
  zone: { lo: 0, hi: 1 },
  /** The hands are playing (one is in view, or fading out). */
  active: false,
  /** The pitch and volume they ask for. */
  pitch: 0.5,
  volume: 0,
};

type Pose = {
  image: { x: number; y: number }[];
  world: Joint[];
  timestampMs: number;
  held?: boolean;
};

const PALM = [0, 5, 9, 13, 17];

/** The palm's middle on the picture (0..1 across, 0..1 down, as you see it). */
const palmOf = (p: Pose): Palm => {
  let x = 0;
  let y = 0;
  PALM.forEach((i) => {
    x += p.image[i].x / PALM.length;
    y += p.image[i].y / PALM.length;
  });
  return { x: x * 0.5 + 0.5, y: 0.5 - y * 0.5 };
};

export const Hands = () => {
  const node = useXRModelNode<XRModelNodeHandTracking>(XRModel.HAND_TRACKER);
  const st = useRef({
    player: new HandPlayer(),
    pitchStamp: -1,
    volumeStamp: -1,
    up: null as boolean[] | null,
    playing: false,
  });
  hands.zone = st.current.player.zone;

  useFrame(() => {
    const s = st.current;
    const on = theremin.started;
    const pick = (side: "left" | "right") => {
      const p = on ? ((node?.poses?.[side] ?? null) as Pose | null) : null;
      return p && !p.held ? p : null;
    };
    const pp = pick(HAND.pitch);
    const vp = pick(HAND.volume);
    hands.pitchTracked = !!pp;
    hands.volumeTracked = !!vp;
    const fresh =
      (pp && pp.timestampMs !== s.pitchStamp) ||
      (vp && vp.timestampMs !== s.volumeStamp);
    // A new reading, or no hands (the fades carry on).
    if (!fresh && (pp || vp)) return;
    if (pp) s.pitchStamp = pp.timestampMs;
    if (vp) {
      s.volumeStamp = vp.timestampMs;
      s.up = fingersUp(vp.world, s.up);
    } else s.up = null;
    hands.pitchPalm = pp ? palmOf(pp) : null;
    hands.volumePalm = vp ? palmOf(vp) : null;
    hands.fist = !!s.up && isFist(s.up);
    const out = s.player.update({
      t: performance.now() / 1000,
      pitch: hands.pitchPalm,
      volume: hands.volumePalm,
      fist: hands.fist,
    });
    hands.muted = out.muted;
    hands.oneHand = out.oneHand;
    hands.level = out.level;
    hands.active = out.active;
    hands.pitch = out.pitch;
    hands.volume = out.volume;
    if (pointerPlaying()) {
      s.playing = false;
      return;
    }
    if (out.active) {
      play(out.pitch, out.volume, "hands");
      s.playing = true;
    } else if (s.playing) {
      release("hands");
      s.playing = false;
    }
  });

  return null;
};
