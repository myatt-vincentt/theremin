// The screen layout: where the theremin, its antennas and fields and the
// ghost hands are, where the camera looks from in each view, how much it
// shows, and where the corner camera sits.
//
// Coordinates are the room's (metres, y up). The theremin stands at the
// room's middle, its audience front facing +z; you play it from behind (−z).
// The pitch antenna is on your right (−x), the volume loop on your left (+x).
import { Quaternion, Vector3 } from "three";

export type View = "front" | "player" | "close";
export const VIEWS: View[] = ["front", "player", "close"];

/** Screen shape → 0 (laptop, wide) … 1 (phone, tall). */
export const phoneness = (aspect: number) =>
  Math.min(1, Math.max(0, (1.5 - aspect) / (1.5 - 0.56)));

export type CameraPose = {
  pos: Vector3;
  target: Vector3;
  /** Vertical field of view (degrees). */
  fov: number;
};

const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
/** The vertical field of view that gives this horizontal one. */
export const vfovFromH = (hfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(hfov) / 2) / Math.max(0.1, aspect)));
/** The horizontal field of view of this vertical one. */
export const hfovFromV = (vfov: number, aspect: number) =>
  deg(2 * Math.atan(Math.tan(rad(vfov) / 2) * aspect));

// ---------------------------------------------------------------- the theremin

/** The theremin's root (the floor under its stand). */
export const THEREMIN_POS = new Vector3(0, 0, -0.3);

/** The pitch antenna's rod (room coordinates): bottom and top. */
export const PITCH_AXIS = {
  bottom: new Vector3(-0.3, 1.075, -0.3325),
  top: new Vector3(-0.3, 1.611, -0.3325),
};
/** The volume loop's centre (room coordinates) and its outer radius (m). */
export const LOOP = { center: new Vector3(0.6, 0.95, -0.3), radius: 0.08 };

/** The fields (room coordinates): the pitch rings and the volume halo. */
export const FIELDS = {
  rings: {
    center: new Vector3(-0.3, 1.3, -0.3325),
    /** Ring k: radius, and how far below the centre it sits (a shallow cone). */
    radii: [0.022, 0.0295, 0.044, 0.0632, 0.0863, 0.1129, 0.1426, 0.1751],
    tube: (k: number) => 0.0009 + 0.0002 * k,
    drop: 0.32,
    /** Alpha: 1 at r 0.015, 0 at the outer ring + 0.03; × this. */
    fadeFrom: 0.015,
    alpha: 0.75,
  },
  halo: {
    center: new Vector3(0.585, 0.985, -0.3),
    radii: new Vector3(0.15, 0.04, 0.115),
    alpha: 0.28,
  },
};

/**
 * The wave ribbon's spine (theremin-local; it rises from the cabinet's top
 * towards the loop's side): x = 0.02 + 0.46 t^1.25, y = 1.06 + 0.40 t^0.85,
 * z = 0.09 … 0.17. Shown in Front.
 */
export const RIBBON = {
  x: [0.02, 0.46, 1.25],
  y: [1.06, 0.4, 0.85],
  z: [0.09, 0.08],
};

/** The colours of the fields, the ribbon, the meter and the ghost hands. */
export const COLOURS = {
  teal: "#56F0DC",
  gold: "#FF9E14",
  meter: "#FFA640",
  dial: "#FFE2B0",
  ghost: "#F2B21C",
  ghostGlow: "#FFB300",
};

/** How strongly each part glows, day and night (the mockup's strengths). */
export const GLOW_STRENGTH = {
  rings: { day: 4.0, night: 2.4 },
  halo: { day: 1.6, night: 1.2 },
  ribbon: { day: 1.9, night: 2.4 },
  ribbonGlow: { day: 1.1, night: 1.4 },
  meter: { day: 6.0, night: 4.0 },
  dial: { day: 1.6, night: 1.2 },
};

export type Placement = { pos: Vector3; quat: Quaternion; mirror?: boolean };
const place = (p: number[], q: number[], mirror = false): Placement => ({
  pos: new Vector3(p[0], p[1], p[2]),
  quat: new Quaternion(q[0], q[1], q[2], q[3]).normalize(),
  mirror,
});

/**
 * The ghost hands' reference poses (room coordinates, the hand's root at the
 * wrist): the pitch hand (your right) beside the antenna, its fingertips about
 * 7 cm from the rod; the volume hand (your left, the same hand mirrored) palm
 * down about 13 cm over the loop.
 */
export const HAND_REF = {
  pitch: place(
    [-0.1693, 1.2554, -0.4344],
    [-0.18188, 0.94427, 0.19546, 0.19252],
  ),
  volume: place(
    [0.5702, 1.1101, -0.3652],
    [-0.08568, -0.50572, -0.84914, 0.12597],
    true,
  ),
};

/**
 * The pitch hand's fingertips from the rod (m): far (the lowest note) … near
 * (the highest). In the reference pose they are 7 cm away.
 */
export const PITCH_REACH = { far: 0.36, near: 0.025, ref: 0.07 };
/**
 * The volume hand's palm over the loop (m): resting on it (silent) … high
 * (loudest). In the reference pose it is 13 cm up.
 */
export const VOLUME_REACH = { low: 0.025, high: 0.3, ref: 0.13 };

// ---------------------------------------------------------------- the views

// Each view's camera: on a laptop (16:9) the vertical field of view, on a
// phone (9:16) the horizontal one it gives. The views widen from there just
// enough to keep their parts on screen (CameraRig.tsx).
const P = 9 / 16;
const FRONT = {
  laptop: { pos: [0.12, 1.6, 1.0], target: [0.12, 1.25, -0.33], vfov: 37.3 },
  phone: {
    pos: [0.12, 1.0, 1.78],
    target: [0.12, 0.86, -0.3],
    hfov: hfovFromV(61.93, P),
  },
};
const PLAYER = {
  laptop: { pos: [0.1, 1.74, -1.1], target: [0.1, 1.1, -0.24], vfov: 58.72 },
  // Narrower than the mockup's very wide phone camera (it widens to fit).
  phone: {
    pos: [0.12, 1.88, -1.22],
    target: [0.1, 1.08, -0.28],
    hfov: hfovFromV(84, P),
  },
};
const CLOSE = {
  laptop: {
    pos: [-0.02, 1.52, 0.52],
    target: [-0.13, 1.13, -0.28],
    vfov: 37.3,
  },
  phone: {
    pos: [-0.08, 1.58, 0.46],
    target: [-0.17, 1.13, -0.28],
    hfov: hfovFromV(73.74, P),
  },
};
const VIEW_POSES = { front: FRONT, player: PLAYER, close: CLOSE };

/* eslint-disable no-param-reassign */
/** A view's camera for this screen shape (before the fit). */
export const viewPose = (view: View, aspect: number, out: CameraPose) => {
  const v = VIEW_POSES[view];
  const k = phoneness(aspect);
  const [lx, ly, lz] = v.laptop.pos;
  const [px, py, pz] = v.phone.pos;
  out.pos.set(lx + (px - lx) * k, ly + (py - ly) * k, lz + (pz - lz) * k);
  const [ltx, lty, ltz] = v.laptop.target;
  const [ptx, pty, ptz] = v.phone.target;
  out.target.set(
    ltx + (ptx - ltx) * k,
    lty + (pty - lty) * k,
    ltz + (ptz - ltz) * k,
  );
  const phoneV = vfovFromH(v.phone.hfov, aspect);
  out.fov = v.laptop.vfov + (phoneV - v.laptop.vfov) * k;
  return out;
};
/* eslint-enable no-param-reassign */

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * The points a view keeps on screen. Front: the cabinet, the antenna's top,
 * the rings and the loop with its hand. Player: the cabinet, the rings and the
 * loop. Close: the pitch rings and the panel from its left end to the dial
 * (the right end may run off on a tall screen).
 */
export const keepPoints = (view: View): Vector3[] => {
  const ringOut = -0.3 - 0.19;
  const ringIn = -0.3 + 0.19;
  if (view === "close")
    return [
      v3(ringOut, 1.25, -0.33),
      v3(ringIn, 1.25, -0.33),
      v3(-0.3, 1.36, -0.33),
      v3(-0.17, 1.4, -0.42),
      v3(-0.35, 0.87, -0.15),
      v3(0.12, 0.87, -0.15),
    ];
  if (view === "player")
    return [
      v3(ringOut, 1.25, -0.33),
      v3(ringIn, 1.25, -0.5),
      v3(0.69, 0.95, -0.3),
      v3(0.6, 1.12, -0.3),
      v3(-0.35, 0.86, -0.15),
      v3(0.35, 0.86, -0.15),
      v3(0, 0.86, -0.45),
    ];
  return [
    v3(-0.3, 1.63, -0.33),
    v3(ringOut, 1.25, -0.33),
    v3(0.7, 0.95, -0.3),
    v3(0.62, 1.2, -0.36),
    v3(-0.36, 0.86, -0.15),
    v3(0.36, 0.86, -0.15),
  ];
};

// ---------------------------------------------------------------- page UI

/** The page gutter (CSS px). */
export const GUTTER = 16;
/** The corner camera's corner radius (CSS px). */
export const FRAME_RADIUS = 16;
/** The dock's distance from the bottom edge, and its height (CSS px). */
export const DOCK_BOTTOM = 22;
export const DOCK_HEIGHT = 58;
/** The note readout sits this far above the dock, and is this tall (CSS px). */
export const READOUT_GAP = 10;
export const READOUT_HEIGHT = 40;

/** Where the corner camera sits (CSS px): top right. */
export const frameRect = (width: number, height: number) => {
  // Portrait-ish on a phone, landscape-ish on a laptop, never extreme.
  const aspect = Math.min(1.33, Math.max(0.75, width / Math.max(1, height)));
  const h = Math.min(220, Math.max(110, height * 0.24));
  const w = Math.round(h * aspect);
  return {
    left: width - GUTTER - w,
    top: GUTTER,
    width: w,
    height: Math.round(h),
  };
};

/**
 * The screen's edges the view keeps clear (NDC, 1 = the edge): the top, and
 * under the corner camera right of its left edge (`frameLeft`); the dock and
 * the readout below.
 */
export const viewMargins = (width: number, height: number) => {
  const h = Math.max(1, height);
  const w = Math.max(1, width);
  const frame = frameRect(width, height);
  const bottomPx =
    DOCK_BOTTOM + DOCK_HEIGHT + READOUT_GAP + READOUT_HEIGHT + 12;
  return {
    side: 0.96,
    top: 1 - (2 * 24) / h,
    under: Math.max(0.2, 1 - (2 * (frame.top + frame.height + 12)) / h),
    frameLeft: (2 * (frame.left - 8)) / w - 1,
    bottom: Math.max(0.3, 1 - (2 * bottomPx) / h),
  };
};

/**
 * For drei's `<Html fullscreen>`: pin the page UI to the screen. By default
 * it follows the scene's origin, which moves on screen with the camera.
 */
export const pinToScreen = (
  _el: unknown,
  _camera: unknown,
  size: { width: number; height: number },
) => [size.width / 2, size.height / 2];

// ---------------------------------------------------------------- the hands

/** Your pitch hand's direction from the rod (level, towards you and the room's middle). */
const PITCH_AWAY = new Vector3(
  HAND_REF.pitch.pos.x - PITCH_AXIS.bottom.x,
  0,
  HAND_REF.pitch.pos.z - PITCH_AXIS.bottom.z,
).normalize();

/** The fingertips' distance from the rod for this pitch (0 low … 1 high), m. */
export const pitchReach = (pitch: number) =>
  PITCH_REACH.far +
  (PITCH_REACH.near - PITCH_REACH.far) * Math.min(1, Math.max(0, pitch));

/** The pitch played by fingertips this far from the rod (m): pitchReach's inverse. */
export const reachToPitch = (metres: number) =>
  Math.min(
    1,
    Math.max(
      0,
      (PITCH_REACH.far - metres) / (PITCH_REACH.far - PITCH_REACH.near),
    ),
  );

/** The palm's height over the loop for this volume (0 … 1), m. */
export const volumeReach = (volume: number) =>
  VOLUME_REACH.low +
  (VOLUME_REACH.high - VOLUME_REACH.low) * Math.min(1, Math.max(0, volume));

/* eslint-disable no-param-reassign */
/** Where the ghost pitch hand's root goes for this pitch (writes `out`). */
export const pitchHandPos = (pitch: number, out: Vector3) =>
  out
    .copy(PITCH_AWAY)
    .multiplyScalar(pitchReach(pitch) - PITCH_REACH.ref)
    .add(HAND_REF.pitch.pos);

/** Where the ghost volume hand's root goes for this volume (writes `out`). */
export const volumeHandPos = (volume: number, out: Vector3) => {
  out.copy(HAND_REF.volume.pos);
  out.y += volumeReach(volume) - VOLUME_REACH.ref;
  return out;
};
/* eslint-enable no-param-reassign */
