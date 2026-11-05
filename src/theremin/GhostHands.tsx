// The two gold ghost hands, playing with you:
//   - the pitch hand (your right) beside the antenna: nearer the rod for
//     higher notes, further away for lower ones
//   - the volume hand (your left, the same hand mirrored) palm down over the
//     loop: higher for louder, resting on the loop when silent
// They follow what is played (a drag, the keys, and later your own hands),
// and breathe a little when still.
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
  Vector3,
  type Object3D,
} from "three";

import { ghostMaterial } from "./ghost";
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

  useFrame(() => {
    if (!hands) return;
    const now = performance.now() / 1000;
    const b = BREATH.reach * Math.sin((2 * Math.PI * now) / BREATH.period);
    pitchHandPos(theremin.shownPitch, hands.pitch.holder.position);
    hands.pitch.holder.position.y += b;
    volumeHandPos(theremin.shownVolume, hands.volume.holder.position);
    hands.volume.holder.position.y += b * 0.6;
    const vi = hands.volume.mesh.morphTargetInfluences;
    if (vi) vi[0] = VOLUME_OPEN;
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
