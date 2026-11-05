// The two gold ghost hands, playing with you:
//   - the pitch hand (your right) beside the antenna: nearer the rod for
//     higher notes, further away for lower ones
//   - the volume hand (your left, the same hand mirrored) palm down over the
//     loop: higher for louder, resting on the loop when silent
// They follow what is played (your hands, a drag or the keys) and breathe a
// little when still. Each opens while it plays, rests relaxed when idle, and
// the volume hand makes a fist when you mute. Seen from the player's side the
// volume hand turns a little on its edge, so it does not read as a flat
// shape from the back.
//
// The model holds one right hand in three poses with the same vertices
// (relaxed, open, fist); they become one mesh whose shape blends between
// them, so a hand can open or curl smoothly.
import { useLayoutEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  Euler,
  Quaternion,
  Vector3,
  type Object3D,
} from "three";

import { ease, GLIDE as VIEW_GLIDE } from "./CameraRig";
import { ghostMaterial } from "./ghost";
import { hands as yours } from "./Hands";
import {
  COLOURS,
  HAND_REF,
  pitchHandPos,
  volumeHandPos,
  type Placement,
} from "./layout";
import { MODELS, useOptionalModel } from "./models";
import { theremin } from "./state";

/** The poses: the base shape, and the two it can blend towards. */
const BASE = "ThereminHand_Relaxed";
const TOWARDS = ["ThereminHand_Open", "ThereminHand_Fist"] as const;
/** The volume hand is a little flatter than the pitch hand (share of Open). */
export const VOLUME_OPEN = 0.2;
/** Breathing when still: how far (m) and how slowly (s per breath). */
const BREATH = { reach: 0.003, period: 3.6 };
/** While playing each hand opens this far (share of Open); poses change at this rate (1/s). */
const PLAYING_OPEN = { pitch: 0.75, volume: 0.8 };
const POSE_RATE = 10;
/** Sounding above this volume counts as playing. */
const PLAYING = 0.03;
/**
 * In Player the volume hand turns about its own axes (degrees: x tips the
 * fingers up, y rolls it onto its edge), blended in as the view glides.
 */
export const PLAYER_TILT = { x: -20, y: 40, z: 0 };

/**
 * A pose's vertices (and normals) in the base pose's own frame: each pose
 * mesh is placed (and quantised) differently, so the vertices are brought
 * through the room and back into the base mesh's frame.
 */
const inBaseFrame = (pose: Mesh, base: Mesh) => {
  pose.updateWorldMatrix(true, false);
  base.updateWorldMatrix(true, false);
  const toBase = new Matrix4()
    .copy(base.matrixWorld)
    .invert()
    .multiply(pose.matrixWorld);
  const g = pose.geometry;
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const p = new Float32Array(pos.count * 3);
  const n = new Float32Array(pos.count * 3);
  const v = new Vector3();
  const normalMat = new Matrix4().copy(toBase);
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(toBase);
    p.set([v.x, v.y, v.z], i * 3);
    if (nor) {
      v.fromBufferAttribute(nor, i).transformDirection(normalMat);
      n.set([v.x, v.y, v.z], i * 3);
    }
  }
  return { p, n };
};

/** One blendable hand mesh, in the hand's frame (wrist at the origin). */
const blendHand = (src: Object3D) => {
  const root = src.getObjectByName("GhostHand_Theremin") ?? src;
  const base = root.getObjectByName(BASE) as Mesh | undefined;
  if (!base?.isMesh) return null;
  const rootInv = new Matrix4();
  root.updateWorldMatrix(true, true);
  rootInv.copy(root.matrixWorld).invert();
  const own = inBaseFrame(base, base);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(own.p, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(own.n, 3));
  if (base.geometry.index) geometry.setIndex(base.geometry.index.clone());
  const targets = TOWARDS.map((name) => {
    const pose = root.getObjectByName(name) as Mesh | undefined;
    if (!pose?.isMesh) return own;
    return inBaseFrame(pose, base);
  });
  // Morph targets hold the difference from the base.
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = targets.map(
    (t) =>
      new Float32BufferAttribute(
        t.p.map((x, i) => x - own.p[i]),
        3,
      ),
  );
  geometry.morphAttributes.normal = targets.map(
    (t) =>
      new Float32BufferAttribute(
        t.n.map((x, i) => x - own.n[i]),
        3,
      ),
  );
  geometry.computeBoundingSphere();
  // The base mesh's placement within the hand.
  const placeInHand = new Matrix4().copy(rootInv).multiply(base.matrixWorld);
  return { geometry, placeInHand };
};

const depthOnly = new MeshBasicMaterial({
  colorWrite: false,
  side: DoubleSide,
});

type Hand = { holder: Group; mesh: Mesh; ref: Placement };

/** A ghost hand: a depth-only copy drawn first, so only its outer surface shows. */
const makeHand = (
  made: NonNullable<ReturnType<typeof blendHand>>,
  ref: Placement,
): Hand => {
  const holder = new Group();
  const look = ghostMaterial(COLOURS.ghost, COLOURS.ghostGlow);
  const mesh = new Mesh(made.geometry, look);
  mesh.applyMatrix4(made.placeInHand);
  mesh.morphTargetInfluences = [0, 0];
  mesh.renderOrder = 5;
  const depth = new Mesh(made.geometry, depthOnly);
  depth.morphTargetInfluences = mesh.morphTargetInfluences;
  depth.renderOrder = 4;
  mesh.add(depth);
  holder.add(mesh);
  holder.quaternion.copy(ref.quat);
  if (ref.mirror) holder.scale.set(-1, 1, 1);
  holder.position.copy(ref.pos);
  return { holder, mesh, ref };
};

export const GhostHands = () => {
  const src = useOptionalModel(MODELS.ghostHand);

  const hands = useMemo(() => {
    if (!src) return null;
    const made = blendHand(src);
    if (!made) return null;
    return {
      pitch: makeHand(made, HAND_REF.pitch),
      volume: makeHand(made, HAND_REF.volume),
    };
  }, [src]);

  const st = useMemo(
    () => ({
      view: theremin.view,
      at: -10,
      from: theremin.view === "player" ? 1 : 0,
      player: theremin.view === "player" ? 1 : 0,
      tilt: new Quaternion(),
      euler: new Euler(),
    }),
    [],
  );

  useFrame((_, rawDt) => {
    if (!hands) return;
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now() / 1000;
    const b = BREATH.reach * Math.sin((2 * Math.PI * now) / BREATH.period);
    pitchHandPos(theremin.shownPitch, hands.pitch.holder.position);
    hands.pitch.holder.position.y += b;
    volumeHandPos(theremin.shownVolume, hands.volume.holder.position);
    hands.volume.holder.position.y += b * 0.6;

    // The poses: open while playing, relaxed when idle, a fist on mute.
    const playing = theremin.shownVolume > PLAYING;
    const k = 1 - Math.exp(-POSE_RATE * dt);
    const blend = (m: Mesh, open: number, fist: number) => {
      const inf = m.morphTargetInfluences;
      if (!inf) return;
      inf[0] += (open - inf[0]) * k;
      inf[1] += (fist - inf[1]) * k;
    };
    blend(hands.pitch.mesh, playing ? PLAYING_OPEN.pitch : 0, 0);
    const muted = yours.volumeTracked && yours.muted;
    let volumeOpen = playing ? PLAYING_OPEN.volume : VOLUME_OPEN;
    if (muted) volumeOpen = 0;
    blend(hands.volume.mesh, volumeOpen, muted ? 1 : 0);

    // In Player the volume hand turns onto its edge.
    if (st.view !== theremin.view) {
      st.view = theremin.view;
      st.at = now;
      st.from = st.player;
    }
    const goal = theremin.view === "player" ? 1 : 0;
    st.player = st.from + (goal - st.from) * ease((now - st.at) / VIEW_GLIDE);
    const d = (Math.PI / 180) * st.player;
    st.tilt.setFromEuler(
      st.euler.set(PLAYER_TILT.x * d, PLAYER_TILT.y * d, PLAYER_TILT.z * d),
    );
    hands.volume.holder.quaternion.copy(HAND_REF.volume.quat).multiply(st.tilt);
  });

  // The hands go into the room once they are on screen.
  const group = useMemo(() => new Group(), []);
  useLayoutEffect(() => {
    if (!hands) return undefined;
    group.add(hands.pitch.holder, hands.volume.holder);
    return () => {
      group.remove(hands.pitch.holder, hands.volume.holder);
    };
  }, [hands, group]);

  return <primitive object={group} />;
};
