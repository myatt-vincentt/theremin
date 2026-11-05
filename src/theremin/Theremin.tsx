// The theremin, and what it shows of the sound:
//   - the pitch rings: thin teal rings around the pitch antenna. They tighten
//     as the pitch rises (your hand nearer the antenna), brighten with the
//     volume, and pulse inward, faster for higher notes
//   - the volume halo: a soft teal glow over the loop, as bright as the volume
//     and lifting a little with your hand
//   - the wave ribbon (in Front): rising from the cabinet, teal fading to warm
//     gold; it waves more tightly for higher notes and more widely when louder
//   - the meter on the front panel (the glow strip, the dial and the pilot
//     jewel) glows with the level
// The theremin does not move between views; only the camera does.
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
} from "three";

import { ease, GLIDE as VIEW_GLIDE } from "./CameraRig";
import { sound } from "./audio";
import {
  COLOURS,
  FIELDS,
  GLOW_STRENGTH,
  RIBBON,
  THEREMIN_POS,
  volumeReach,
  VOLUME_REACH,
} from "./layout";
import { dressModel } from "./look";
import { MODELS, useOptionalModel, useOptionalTexture } from "./models";
import { theremin } from "./state";

/** Everything the rest of the scene reads about the theremin. */
export const rig = {
  /** The theremin (its children are in its own frame). */
  root: new Group(),
  /** 0 … 1: how far the view is Front (the ribbon shows there), eased. */
  front: theremin.view === "front" ? 1 : 0,
  /** 0 day … 1 night, eased (as the studio). */
  night: theremin.night ? 1 : 0,
};
rig.root.position.copy(THEREMIN_POS);

/**
 * The rings: how much smaller they are at the highest note than the lowest
 * (× radius), how dim when silent, how much each pulse adds, and the pulse's
 * speed (rings per second at the lowest and highest note). Thicker than
 * modelled (× tube) so they read on a phone.
 */
const RINGS = {
  tightest: 0.68,
  widest: 1.12,
  idle: 0.22,
  pulse: 0.9,
  speed: [0.8, 3.2],
  tube: 2.2,
};
/** The halo: dim when silent, and how far it lifts with the hand (share of the hand's rise). */
const HALO = { idle: 0.25, lift: 0.35 };
/**
 * The ribbon's wave: cycles along it (lowest … highest note), its width
 * (m, silent … loudest), and how fast it travels (radians / s, lowest …
 * highest note). Its strips: the main one, two thin companions, a soft glow.
 */
const WAVE = {
  cycles: [3, 8],
  amp: [0.012, 0.06],
  speed: [2.5, 9],
  idle: 0.3,
};
const STRIPS = [
  { width: 0.016, phase: 0, alpha: 1, glow: false },
  { width: 0.006, phase: 1.2, alpha: 0.55, glow: false },
  { width: 0.005, phase: 2.4, alpha: 0.4, glow: false },
  { width: 0.06, phase: 0, alpha: 0.25, glow: true },
];
/** The meter's glow at silence and at full level (× its strength), and a day/night scale. */
const METER = { idle: 0.18, scale: 0.35 };
/**
 * The mockup's glow strengths are a renderer's emission; here the fields add
 * their light on top of the room, so they take this share of it (brighter,
 * the tone curve turns the teal white). The rings and the halo are drawn
 * over the room (not added to it) so they stay teal against a light wall.
 */
const FIELD_SCALE = {
  rings: 0.3,
  halo: 0.55,
  ribbon: { day: 0.13, night: 0.22 },
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const dayNight = (g: { day: number; night: number }, k: number) =>
  lerp(g.day, g.night, k);

// ---------------------------------------------------------------- the ribbon

const ribbonVert = /* glsl */ `
  uniform float uTime;
  uniform float uCycles;
  uniform float uAmp;
  uniform float uPhase;
  uniform float uWidth;
  varying float vT;
  varying float vSide;

  vec3 spine(float t) {
    return vec3(
      ${RIBBON.x[0].toFixed(3)} + ${RIBBON.x[1].toFixed(3)} * pow(t, ${RIBBON.x[2].toFixed(3)}),
      ${RIBBON.y[0].toFixed(3)} + ${RIBBON.y[1].toFixed(3)} * pow(t, ${RIBBON.y[2].toFixed(3)}),
      ${RIBBON.z[0].toFixed(3)} + ${RIBBON.z[1].toFixed(3)} * t);
  }
  vec3 curve(float t) {
    float e = 0.002;
    vec3 a = spine(clamp(t - e, 0.0, 1.0));
    vec3 b = spine(clamp(t + e, 0.0, 1.0));
    vec3 d = normalize(b - a);
    vec3 n = normalize(vec3(-d.y, d.x, 0.0));
    float amp = uAmp * (0.3 + 0.7 * t) * smoothstep(0.0, 0.12, t);
    return spine(t) + n * amp * sin(6.2831853 * uCycles * t - uTime + uPhase);
  }
  void main() {
    float t = uv.x;
    float e = 0.003;
    vec3 d = curve(min(1.0, t + e)) - curve(max(0.0, t - e));
    vec3 w = normalize(vec3(-d.y, d.x, 0.0));
    vec3 p = curve(t) + w * (uv.y - 0.5) * uWidth;
    vT = t;
    vSide = uv.y * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const ribbonFrag = /* glsl */ `
  uniform vec3 uTeal;
  uniform vec3 uGold;
  uniform float uStrength;
  uniform float uAlpha;
  uniform float uSoft;
  varying float vT;
  varying float vSide;
  void main() {
    vec3 c = mix(uTeal, uGold, smoothstep(0.05, 0.95, vT)) * uStrength;
    float across = 1.0 - abs(vSide);
    across = uSoft > 0.5 ? across * across : smoothstep(0.0, 0.5, across);
    float ends = smoothstep(0.0, 0.1, vT) * (1.0 - smoothstep(0.8, 1.0, vT));
    gl_FragColor = vec4(c, uAlpha * across * ends);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const makeRibbon = (teal: Color, gold: Color) =>
  STRIPS.map((s) => {
    const m = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCycles: { value: 5 },
        uAmp: { value: 0.05 },
        uPhase: { value: s.phase },
        uWidth: { value: s.width },
        uTeal: { value: teal },
        uGold: { value: gold },
        uStrength: { value: 1 },
        uAlpha: { value: s.alpha },
        uSoft: { value: s.glow ? 1 : 0 },
      },
      vertexShader: ribbonVert,
      fragmentShader: ribbonFrag,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1, 240, 1), m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 6;
    return { mesh, m, strip: s };
  });

// ---------------------------------------------------------------- the halo

const haloVert = /* glsl */ `
  varying float vFacing;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const haloFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vFacing;
  void main() {
    // A soft disc: a gentle glow through the middle, brighter towards the rim.
    float a = pow(1.0 - vFacing, 2.2) * 0.75 + 0.35 * vFacing * vFacing;
    gl_FragColor = vec4(uColor, a * uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---------------------------------------------------------------- the theremin

type Parts = {
  body: Object3D;
  meter: { m: MeshStandardMaterial; base: Color; strength: "meter" | "dial" }[];
};

/** The meter's glowing materials get their own copies (their glow follows the level). */
/**
 * The cabinet's walnut: a fine, straight grain (its own texture, in place of
 * the model's), this many times along and across the wood.
 */
const WALNUT = { repeat: [1, 1] as [number, number], anisotropy: 8 };

const dressTheremin = (src: Object3D, walnut: Texture | null): Parts => {
  const body = src.clone(true);
  body.position.set(0, 0, 0);
  body.quaternion.identity();
  dressModel(body);
  const meter: Parts["meter"] = [];
  const made = new Map<Material, MeshStandardMaterial>();
  body.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mt) => {
      const std = mt as MeshStandardMaterial;
      if (std.name === "Walnut" && walnut) {
        let m = made.get(std);
        if (!m) {
          m = std.clone();
          m.map = walnut;
          m.needsUpdate = true;
          made.set(std, m);
        }
        return m;
      }
      if (std.name === "Theremin_DialGlass") {
        // The glass lets the shadows through and casts none.
        mesh.castShadow = false;
        return std;
      }
      if (std.name !== "Theremin_MeterGlow" && std.name !== "Theremin_DialFace")
        return std;
      let m = made.get(std);
      if (!m) {
        m = std.clone();
        made.set(std, m);
        meter.push({
          m,
          base: std.emissive.clone(),
          strength: std.name === "Theremin_DialFace" ? "dial" : "meter",
        });
      }
      return m;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  return { body, meter };
};

export const Theremin = () => {
  const src = useOptionalModel(MODELS.theremin);
  const walnutMap = useOptionalTexture(MODELS.walnut);
  const gl = useThree((st) => st.gl);
  const parts = useMemo(() => {
    if (!src) return null;
    if (!walnutMap) return dressTheremin(src, null);
    walnutMap.colorSpace = SRGBColorSpace;
    walnutMap.flipY = false;
    walnutMap.wrapS = RepeatWrapping;
    walnutMap.wrapT = RepeatWrapping;
    walnutMap.repeat.set(...WALNUT.repeat);
    walnutMap.anisotropy = Math.min(
      WALNUT.anisotropy,
      gl.capabilities.getMaxAnisotropy(),
    );
    walnutMap.needsUpdate = true;
    return dressTheremin(src, walnutMap);
  }, [src, walnutMap, gl]);

  const teal = useMemo(() => new Color(COLOURS.teal), []);
  const gold = useMemo(() => new Color(COLOURS.gold), []);

  // The fields and the ribbon (built once, in the theremin's own frame).
  const fx = useMemo(() => {
    const group = new Group();
    const r = FIELDS.rings;
    const local = r.center.clone().sub(THEREMIN_POS);
    const rings = r.radii.map((radius, k) => {
      const m = new MeshBasicMaterial({
        color: teal.clone(),
        transparent: true,
        depthWrite: false,
      });
      const mesh = new Mesh(
        new TorusGeometry(radius, r.tube(k) * RINGS.tube, 6, 128),
        m,
      );
      mesh.rotation.x = Math.PI / 2;
      mesh.renderOrder = 6;
      mesh.position.copy(local);
      group.add(mesh);
      const fade =
        1 -
        Math.min(
          1,
          Math.max(
            0,
            (radius - r.fadeFrom) /
              (r.radii[r.radii.length - 1] + 0.03 - r.fadeFrom),
          ),
        );
      return { mesh, m, radius, alpha: fade * r.alpha };
    });
    const h = FIELDS.halo;
    const haloMat = new ShaderMaterial({
      uniforms: {
        uColor: { value: teal.clone() },
        uAlpha: { value: h.alpha },
      },
      vertexShader: haloVert,
      fragmentShader: haloFrag,
      transparent: true,
      depthWrite: false,
    });
    const halo = new Mesh(new SphereGeometry(1, 48, 16), haloMat);
    halo.scale.copy(h.radii);
    halo.position.copy(h.center).sub(THEREMIN_POS);
    halo.renderOrder = 6;
    group.add(halo);
    const ribbon = makeRibbon(teal, gold);
    ribbon.forEach((s) => group.add(s.mesh));
    return { group, rings, halo, haloMat, ribbon, ringLocal: local };
  }, [teal, gold]);

  const st = useRef({
    pulse: 0,
    wave: 0,
    front: rig.front,
    view: theremin.view,
    viewAt: -10,
    viewFrom: rig.front,
  });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    const now = performance.now() / 1000;
    const { shownPitch: pitch } = theremin;
    const { shownVolume: vol } = theremin;
    const { level } = sound.last;
    // Day ⇄ night, and how far the view is Front (eased with the camera).
    rig.night +=
      ((theremin.night ? 1 : 0) - rig.night) * (1 - Math.exp(-dt / 0.3));
    if (s.view !== theremin.view) {
      s.view = theremin.view;
      s.viewAt = now;
      s.viewFrom = rig.front;
    }
    const goal = theremin.view === "front" ? 1 : 0;
    rig.front = lerp(s.viewFrom, goal, ease((now - s.viewAt) / VIEW_GLIDE));
    const { night: n } = rig;

    // The rings.
    const r = FIELDS.rings;
    const tight = lerp(RINGS.widest, RINGS.tightest, pitch);
    s.pulse += dt * lerp(RINGS.speed[0], RINGS.speed[1], pitch);
    const strength = dayNight(GLOW_STRENGTH.rings, n) * FIELD_SCALE.rings;
    const lit = lerp(RINGS.idle, 1, Math.min(1, vol * 1.2));
    /* eslint-disable no-param-reassign */
    fx.rings.forEach((ring, k) => {
      const radius = ring.radius * tight;
      ring.mesh.scale.set(tight, tight, tight);
      ring.mesh.position.y =
        fx.ringLocal.y - r.drop * (radius - r.radii[0] * tight);
      // A pulse travels inward, towards the antenna.
      const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * (s.pulse + k / 3));
      const bright = lit * (1 + RINGS.pulse * vol * (wave * wave - 0.35));
      ring.m.color.copy(teal).multiplyScalar(strength * bright);
      ring.m.opacity = Math.min(1, ring.alpha * (0.6 + 0.8 * bright));
    });
    /* eslint-enable no-param-reassign */

    // The halo.
    const h = FIELDS.halo;
    const hand = volumeReach(vol) - VOLUME_REACH.low;
    fx.halo.position.y = h.center.y - THEREMIN_POS.y + hand * HALO.lift;
    fx.halo.scale.set(h.radii.x, h.radii.y * (1 + 0.6 * vol), h.radii.z);
    (fx.haloMat.uniforms.uColor.value as Color)
      .copy(teal)
      .multiplyScalar(dayNight(GLOW_STRENGTH.halo, n) * FIELD_SCALE.halo);
    fx.haloMat.uniforms.uAlpha.value = h.alpha * lerp(HALO.idle, 2, vol);

    // The ribbon (Front only).
    s.wave += dt * lerp(WAVE.speed[0], WAVE.speed[1], pitch);
    const show =
      rig.front * lerp(WAVE.idle, 1, Math.min(1, Math.max(vol, level * 1.5)));
    fx.ribbon.forEach(({ mesh, m, strip }) => {
      /* eslint-disable no-param-reassign */
      mesh.visible = rig.front > 0.01;
      const u = m.uniforms;
      u.uTime.value = s.wave;
      u.uCycles.value = lerp(WAVE.cycles[0], WAVE.cycles[1], pitch);
      u.uAmp.value = lerp(WAVE.amp[0], WAVE.amp[1], vol);
      u.uStrength.value =
        dayNight(
          strip.glow ? GLOW_STRENGTH.ribbonGlow : GLOW_STRENGTH.ribbon,
          n,
        ) * dayNight(FIELD_SCALE.ribbon, n);
      u.uAlpha.value = strip.alpha * show;
      /* eslint-enable no-param-reassign */
    });

    // The meter glows with the level.
    if (parts) {
      const glow = lerp(METER.idle, 1, Math.min(1, level * 1.6));
      parts.meter.forEach(({ m, base, strength: which }) => {
        m.emissive.copy(base);
        // eslint-disable-next-line no-param-reassign
        m.emissiveIntensity =
          dayNight(GLOW_STRENGTH[which], n) * METER.scale * glow;
      });
    }
  });

  // The theremin and its fields go into its holder once on screen (a render
  // that is thrown away while something else loads leaves none behind).
  useLayoutEffect(() => {
    if (!parts) return undefined;
    rig.root.add(parts.body);
    rig.root.add(fx.group);
    return () => {
      rig.root.remove(parts.body);
      rig.root.remove(fx.group);
    };
  }, [parts, fx]);

  return <primitive object={rig.root} />;
};
