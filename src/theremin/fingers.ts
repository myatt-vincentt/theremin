// Is a hand a fist? Read from the tracker's 21 hand joints in 3D, from the
// hand's own shape (so a palm facing the camera, turned a little or tipped,
// reads the same). Plain code (no scene).
//
// A finger is up when its tip is well beyond its middle joint as seen from
// the wrist and the finger is fairly straight; folded when its tip has come
// back towards the palm. In between, it keeps what it was (no flicker at the
// edge). A fist: no finger up.

export type Joint = { x: number; y: number; z: number };

/** The four fingers' joints: knuckle, middle joint, top joint, tip. */
const FINGER_JOINTS = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
const WRIST = 0;

/**
 * Up: the tip is this much further from the wrist than the middle joint, and
 * the finger bends less than this at its middle joint (cosine of the angle
 * between the knuckle→middle and middle→tip directions). Folded: the tip
 * is no further out than this, or the finger bends past this.
 */
export const FINGER = {
  upReach: 1.18,
  upStraight: 0.45,
  downReach: 1.04,
  downStraight: 0.05,
};

const dist = (a: Joint, b: Joint) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const sub = (a: Joint, b: Joint) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const cosBetween = (a: Joint, b: Joint) => {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (la < 1e-9 || lb < 1e-9) return 1;
  return (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
};

/** One finger's reach (tip ÷ middle joint, from the wrist) and straightness (cosine). */
export const fingerShape = (j: readonly Joint[], finger: number) => {
  const [mcp, pip, , tip] = FINGER_JOINTS[finger].map((i) => j[i]);
  const reach = dist(j[WRIST], tip) / Math.max(1e-6, dist(j[WRIST], pip));
  const straight = cosBetween(sub(pip, mcp), sub(tip, pip));
  return { reach, straight };
};

/**
 * Which fingers are up (index, middle, ring, pinky), given what they were
 * (`was`, for the in-between zone; null reads in-between as folded).
 */
export const fingersUp = (
  j: readonly Joint[],
  was: readonly boolean[] | null = null,
): boolean[] =>
  [0, 1, 2, 3].map((f) => {
    const { reach, straight } = fingerShape(j, f);
    if (reach >= FINGER.upReach && straight >= FINGER.upStraight) return true;
    if (reach <= FINGER.downReach || straight <= FINGER.downStraight)
      return false;
    return was ? was[f] : false;
  });

/** A fist: no finger up. */
export const isFist = (up: readonly boolean[]) => up.every((u) => !u);
