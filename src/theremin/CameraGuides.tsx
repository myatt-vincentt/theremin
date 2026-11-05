// Thin guides drawn over your camera in the corner, so you can see where
// your hands play: a pitch ruler across the right half of the picture (a
// tick at each note of C major, named in Scale; a dot at the pitch sounding)
// and a volume bar up the left side (filled to the volume). Subtle: teal and
// gold, mostly see-through. In a song the note to play glows gold on the
// ruler, so you see where to move your right hand. Drawn in the picture's own frame (the same cover
// crop as the corner camera), so a tick sits where your hand plays that note.
import { useEffect, useRef } from "react";

import { hands } from "./Hands";
import { VOLUME_ZONE } from "./handPlay";
import { COLOURS } from "./layout";
import { noteName, SCALE_NOTES, LOW_MIDI, HIGH_MIDI } from "./pitch";
import { theremin } from "./state";

/** How see-through the guides are; the ruler's height on the picture, the bar's place across the panel (shares). */
const GUIDE = { alpha: 0.4, dot: 0.85, target: 0.95, rulerY: 0.9, barX: 0.07 };

/** The same crop as the corner camera's (CameraFrame.tsx): picture → panel. */
const cropMid = (k: number) => Math.min(0.5 + 0.12, 1 - 0.5 * k);
/** A point on the picture (0..1 across, 0..1 down) → on the panel (0..1, down). */
export const toPanel = (
  x: number,
  y: number,
  panelAspect: number,
  screenAspect: number,
) => {
  const up = 1 - y;
  if (panelAspect > screenAspect) {
    const k = screenAspect / panelAspect;
    return { x, y: 1 - (0.5 + (up - cropMid(k)) / k) };
  }
  return { x: 0.5 + ((x - 0.5) * screenAspect) / panelAspect, y };
};

export const CameraGuides = ({
  rect,
  screen,
  shown,
}: {
  rect: { left: number; top: number; width: number; height: number };
  screen: { width: number; height: number };
  shown: boolean;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const geo = useRef({ rect, screen });
  geo.current = { rect, screen };

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const { rect: r, screen: s } = geo.current;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      const g = c.getContext("2d");
      if (!g) return;
      g.clearRect(0, 0, w, h);
      const pa = r.width / Math.max(1, r.height);
      const sa = s.width / Math.max(1, s.height);
      const at = (x: number, y: number) => {
        const p = toPanel(x, y, pa, sa);
        return { x: p.x * w, y: p.y * h };
      };
      const line = Math.max(1, dpr);

      // The pitch ruler.
      const { lo, hi } = hands.zone;
      const xOf = (midi: number) =>
        lo + ((hi - lo) * (midi - LOW_MIDI)) / (HIGH_MIDI - LOW_MIDI);
      const a = at(lo, GUIDE.rulerY);
      const b = at(hi, GUIDE.rulerY);
      g.globalAlpha = GUIDE.alpha;
      g.strokeStyle = COLOURS.teal;
      g.fillStyle = COLOURS.teal;
      g.lineWidth = line;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      const scale = theremin.mode === "scale";
      g.font = `600 ${Math.round(7 * dpr)}px system-ui, -apple-system, sans-serif`;
      g.textAlign = "center";
      SCALE_NOTES.forEach((m) => {
        const p = at(xOf(m), GUIDE.rulerY);
        const isC = m % 12 === 0;
        const len = (isC ? 7 : 4) * dpr;
        g.beginPath();
        g.moveTo(p.x, p.y - len);
        g.lineTo(p.x, p.y);
        g.stroke();
        if (scale)
          g.fillText(noteName(m).replace(/\d/, ""), p.x, p.y - len - 2 * dpr);
      });
      // In a song, the note to play glows gold on the ruler.
      if (theremin.target !== null) {
        const p = at(xOf(theremin.target), GUIDE.rulerY);
        g.save();
        g.globalAlpha = GUIDE.target;
        g.strokeStyle = COLOURS.ghost;
        g.fillStyle = COLOURS.ghost;
        g.shadowColor = COLOURS.ghostGlow;
        g.shadowBlur = 8 * dpr;
        g.lineWidth = 3 * dpr;
        g.beginPath();
        g.moveTo(p.x, p.y - 16 * dpr);
        g.lineTo(p.x, p.y + 5 * dpr);
        g.stroke();
        // Its name on a small dark pill, so it reads over a hand.
        const label = noteName(theremin.target).replace(/\d/, "");
        g.shadowBlur = 0;
        g.fillStyle = "rgb(20 20 24 / .75)";
        g.beginPath();
        g.arc(p.x, p.y - 23 * dpr, 6.5 * dpr, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = COLOURS.ghost;
        g.font = `700 ${Math.round(9 * dpr)}px system-ui, -apple-system, sans-serif`;
        g.textBaseline = "middle";
        g.fillText(label, p.x, p.y - 22.5 * dpr);
        g.textBaseline = "alphabetic";
        g.restore();
        g.fillStyle = COLOURS.teal;
      }
      // The pitch sounding.
      const sounding = performance.now() / 1000 - theremin.playedAt < 0.3;
      const d = at(xOf(theremin.midi), GUIDE.rulerY);
      g.globalAlpha = sounding ? GUIDE.dot : GUIDE.alpha;
      g.beginPath();
      g.arc(d.x, d.y, 2.6 * dpr, 0, Math.PI * 2);
      g.fill();

      // The volume bar (at the panel's left edge, however the picture is cropped).
      const top = { x: GUIDE.barX * w, y: at(0.5, VOLUME_ZONE.top).y };
      const bottom = { x: GUIDE.barX * w, y: at(0.5, VOLUME_ZONE.bottom).y };
      g.globalAlpha = GUIDE.alpha;
      g.strokeStyle = COLOURS.ghost;
      g.fillStyle = COLOURS.ghost;
      g.lineWidth = line;
      g.beginPath();
      g.moveTo(top.x, top.y);
      g.lineTo(bottom.x, bottom.y);
      g.stroke();
      const v = theremin.shownVolume;
      if (v > 0.01) {
        g.globalAlpha = hands.muted ? GUIDE.alpha * 0.5 : GUIDE.dot;
        g.lineWidth = 3 * dpr;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(bottom.x, bottom.y);
        g.lineTo(bottom.x, bottom.y + (top.y - bottom.y) * v);
        g.stroke();
        g.lineCap = "butt";
      }
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-hud="camera-guides"
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        borderRadius: 16,
        pointerEvents: "none",
        opacity: shown ? 1 : 0,
        transition: "opacity 300ms ease-out",
      }}
    />
  );
};
