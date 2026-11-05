// The page UI, minimal, on Night glass:
//   - your camera, top right (CameraFrame.tsx): tap it to tuck it away; a
//     small camera button then sits in the corner to bring it back
//   - one floating dock, bottom centre, icons only: songs (opens the songs
//     card; while a song runs, stops it), the pitch mode (Free or Scale), the view (front, player, close), day / night, and how to play.
//     A small label shows over a button on hover, or for a moment after a tap.
//   - the note readout just above the dock: the note sounding now
//   - the songs card, the note lane card and the finish card (SongUI.tsx)
//   - thin guides over the corner camera: the pitch ruler and the volume bar
//     (CameraGuides.tsx)
//   - the how-to-play steps (after Start, or from the dock)
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useXRReady } from "@vincentt-xr/sdk/low-level";

import { CameraGuides } from "./CameraGuides";
import { stopSong } from "./SongPlayer";
import { NoteIcon, SONG_CSS, SongUI, StopIcon } from "./SongUI";
import {
  COLOURS,
  DOCK_BOTTOM,
  DOCK_HEIGHT,
  frameRect,
  GUTTER,
  pinToScreen,
  READOUT_GAP,
  READOUT_HEIGHT,
  type View,
} from "./layout";
import { PITCH_MODE_LABEL, type PitchMode } from "./pitch";
import {
  closeHowTo,
  INTRO_CARD_MS,
  nextMode,
  nextView,
  setNight,
  theremin,
  toggleCam,
  useThereminVersion,
} from "./state";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const ACCENT = "#f4d968";
/** After a tap the label stays this long (ms). */
const TAP_LABEL = 1000;

const CSS = `
.vl-root { position: absolute; inset: 0; pointer-events: none; color: #fff;
  -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.vl-glass { background: rgb(35 37 40 / .64);
  backdrop-filter: blur(20px) saturate(1.5); -webkit-backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgb(235 246 253 / .18);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / .22), 0 8px 24px rgb(0 0 0 / .22); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .vl-glass { background: rgb(35 37 40 / .82); } }
.vl-dock { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + ${DOCK_BOTTOM}px);
  display: flex; gap: 6px; padding: 6px; border-radius: 999px; pointer-events: auto; }
.vl-btn { pointer-events: auto; border: 0; padding: 0; margin: 0; color: inherit; position: relative;
  display: grid; place-items: center; cursor: pointer; outline: none; touch-action: manipulation;
  width: 44px; height: 44px; border-radius: 50%; background: transparent;
  transition: transform 160ms ease-out, background 200ms ${EASE}; }
.vl-btn:hover { background: rgb(255 255 255 / .08); }
.vl-btn:active { transform: scale(0.94); }
.vl-btn:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.vl-btn.on { color: ${ACCENT}; background: rgb(244 217 104 / .14); }
.vl-btn .vl-mark { position: absolute; bottom: 3px; right: 3px; width: 15px; height: 15px;
  border-radius: 50%; background: ${ACCENT}; color: #232528; display: grid; place-items: center;
  font: 700 9px/1 system-ui, -apple-system, sans-serif; }
.vl-tip { position: absolute; bottom: calc(100% + 12px); left: 50%; transform: translate(-50%, 4px);
  padding: 6px 10px; border-radius: 10px; white-space: nowrap; opacity: 0; pointer-events: none;
  font: 600 12px/1 system-ui, -apple-system, sans-serif;
  transition: opacity 220ms ${EASE}, transform 220ms ${EASE}; }
.vl-tip.show { opacity: 1; transform: translate(-50%, 0); }
@media (hover: hover) { .vl-btn:hover .vl-tip { opacity: 1; transform: translate(-50%, 0); } }
.vl-cam { position: absolute; pointer-events: auto; border: 0; padding: 0; margin: 0;
  background: transparent; cursor: pointer; border-radius: 16px; outline: none; }
.vl-cam:focus-visible { box-shadow: 0 0 0 2px ${ACCENT}; }
.vl-show { position: absolute; right: ${GUTTER}px; top: ${GUTTER}px; }
.vl-nocam { position: absolute; display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border-radius: 16px; font: 600 12px/1.35 system-ui, -apple-system, sans-serif; color: rgb(255 255 255 / .9);
  animation: vl-fade 260ms ${EASE} both; }
.vl-nocam svg { flex: none; color: rgb(255 255 255 / .7); }
.vl-gone { opacity: 0; pointer-events: none; }
.vl-howto-back { position: absolute; inset: 0; pointer-events: auto; background: rgb(10 10 14 / .25);
  animation: vl-fade 260ms ${EASE} both; }
@keyframes vl-fade { from { opacity: 0; } to { opacity: 1; } }
.vl-howto { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  padding: 16px 18px; border-radius: 22px; display: flex; flex-direction: column; gap: 12px;
  width: min(360px, calc(100% - 32px)); animation: vl-pop2 360ms ${EASE} both; }
@keyframes vl-pop2 { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
.vl-step { display: flex; align-items: center; gap: 14px; font: 600 15px/1.25 system-ui, -apple-system, sans-serif; }
.vl-step .vl-pic { flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center;
  background: rgb(255 255 255 / .08); color: #fff; }
.vl-readout { position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + ${DOCK_BOTTOM + DOCK_HEIGHT + READOUT_GAP}px);
  height: ${READOUT_HEIGHT}px; padding: 0 16px; border-radius: 999px; display: flex; align-items: center; gap: 10px;
  font: 650 17px/1 system-ui, -apple-system, sans-serif; font-variant-numeric: tabular-nums;
  transition: opacity 400ms ${EASE}; }
.vl-readout .vl-mode { font: 600 11px/1 system-ui, -apple-system, sans-serif; letter-spacing: .04em;
  text-transform: uppercase; color: rgb(255 255 255 / .6); }
.vl-readout .vl-note { min-width: 2.6em; text-align: center; color: ${COLOURS.teal}; }
.vl-readout.quiet .vl-note { color: rgb(255 255 255 / .55); }
.vl-keys { display: inline-flex; gap: 3px; margin-left: 2px; }
.vl-keys kbd { font: 650 10px/1 system-ui, -apple-system, sans-serif; padding: 3px 4px; border-radius: 5px;
  background: rgb(255 255 255 / .12); color: #fff; }
.vl-step .vl-num { color: ${ACCENT}; font-weight: 700; margin-right: 2px; }
.vl-count { position: absolute; left: 22px; right: 22px; bottom: -1px; height: 2px; border-radius: 2px;
  background: rgb(255 255 255 / .12); overflow: hidden; }
.vl-count > div { height: 100%; background: ${ACCENT}; transform-origin: 0 50%;
  animation: vl-count var(--vl-count) linear both; }
@keyframes vl-count { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.vl-leave, .vl-leave .vl-howto { animation: vl-out 320ms ${EASE} both; pointer-events: none; }
@keyframes vl-out { to { opacity: 0; } }
.vl-dock.pulse::after { content: ""; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  animation: vl-pulse 1500ms ${EASE} both; }
@keyframes vl-pulse { from { box-shadow: 0 0 0 0 rgb(244 217 104 / .6); }
  to { box-shadow: 0 0 0 22px rgb(244 217 104 / 0); } }
@media (prefers-reduced-motion: reduce) { .vl-howto, .vl-howto-back, .vl-dock.pulse::after { animation: none; } }
`;
const Icon = ({
  children,
  size = 20,
}: {
  children: ReactNode;
  size?: number;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const CameraIcon = () => (
  <Icon>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);
/** A camera, crossed out. */
const NoCameraIcon = () => (
  <Icon size={18}>
    <path d="M2.5 2.5l19 19" />
    <path d="M9 6h6.5L17 8h3a1 1 0 0 1 1 1v8.5M18 19H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h3" />
    <path d="M10 10.6a3.5 3.5 0 0 0 4.4 4.4" />
  </Icon>
);
const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" />
    <circle cx="12" cy="17" r=".6" fill="currentColor" />
  </Icon>
);
const ViewIcon = () => (
  <Icon>
    <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icon>
);
const MoonIcon = () => (
  <Icon>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Icon>
);

// ---------------------------------------------------------------- how to play

/** A step picture: a 24 grid drawn large, with a lighter line. */
const Pic = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width={40}
    height={40}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** A finger dragging across the screen, towards the antenna. */
const PicAcross = () => (
  <Pic>
    <path d="M4 3v18" />
    <circle cx="4" cy="2.5" r="1" />
    <path d="M20 12H9M12 9l-3 3 3 3" opacity=".7" />
    <path d="M7.5 7.5a6 6 0 0 1 0 9" opacity=".5" />
  </Pic>
);
/** A palm rising over a loop: louder. */
const PicUp = () => (
  <Pic>
    <ellipse cx="12" cy="19" rx="7" ry="2" opacity=".7" />
    <path d="M12 15V4M9 7l3-3 3 3" />
  </Pic>
);
/** Keys on a keyboard. */
const PicKeys = () => (
  <Pic>
    <rect x="2" y="7" width="20" height="10" rx="2" opacity=".6" />
    <path d="M6 10.5h1M9.5 10.5h1M13 10.5h1M16.5 10.5h1M7 14h10" />
  </Pic>
);
/** A staircase of notes: snap to the scale. */
const PicScale = () => (
  <Pic>
    <path d="M3 19h4v-4h4v-4h4V7h4V4" />
    <path d="M3 21c5 0 9-6 18-17" opacity=".45" />
  </Pic>
);

type Step = { key: string; pic: ReactNode; text: ReactNode; tint?: string };
const STEPS: Step[] = [
  {
    key: "pitch",
    pic: <PicAcross />,
    text: "Right hand: move toward the antenna side for higher notes",
    tint: COLOURS.teal,
  },
  {
    key: "volume",
    pic: <PicUp />,
    text: "Left hand: raise to play louder, lower or fist to go quiet",
    tint: COLOURS.ghost,
  },
  {
    key: "scale",
    pic: <PicScale />,
    text: "Scale mode snaps to notes; Free glides",
  },
  {
    key: "touch",
    pic: <PicKeys />,
    text: (
      <>
        Or drag on the stage, or hold{" "}
        <span className="vl-keys">
          <kbd>A</kbd>
          <kbd>…</kbd>
          <kbd>K</kbd>
        </span>{" "}
        (Shift: octave up; ↑ ↓ volume)
      </>
    ),
  },
];

const NO_CAMERA = "No camera: drag on the stage, or hold A to K";
const MODE_MARK: Record<PitchMode, string> = { free: "F", scale: "S" };

/** The pitch mode's mark in the dock: a wave. */
const ModeIcon = () => (
  <Icon>
    <path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3-4 5-2" />
  </Icon>
);

// ---------------------------------------------------------------- the dock

const VIEW_MARK: Record<View, string> = { front: "1", player: "2", close: "3" };
const VIEW_LABEL: Record<View, string> = {
  front: "View: Front",
  player: "View: Player",
  close: "View: Close",
};

type DockButton = {
  id: string;
  label: string;
  icon: ReactNode;
  on?: boolean;
  mark?: string;
  act: () => void;
};

/** True while nothing sounds (checked a few times a second). */
const useQuiet = () => {
  const [quiet, setQuiet] = useState(true);
  useEffect(() => {
    const t = window.setInterval(() => {
      setQuiet(performance.now() / 1000 - theremin.playedAt > 0.3);
    }, 150);
    return () => window.clearInterval(t);
  }, []);
  return quiet;
};

export const Hud = () => {
  useThereminVersion();
  const [tapped, setTapped] = useState<string | null>(null);
  const tapTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(tapTimer.current), []);
  // The first steps card closes by itself; a closing card fades out.
  const until = theremin.howToUntil;
  useEffect(() => {
    if (until === null) return undefined;
    const t = window.setTimeout(
      () => closeHowTo(),
      Math.max(0, until - performance.now()),
    );
    return () => window.clearTimeout(t);
  }, [until]);
  const open = theremin.howTo;
  const [leaving, setLeaving] = useState(false);
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current === open) return undefined;
    wasOpen.current = open;
    setLeaving(!open);
    if (open) return undefined;
    const t = window.setTimeout(() => setLeaving(false), 320);
    return () => window.clearTimeout(t);
  }, [open]);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const frame = frameRect(width, height);
  const hidden = theremin.camHidden;
  // No camera picture (none, or refused): the corner says how to play instead.
  const camera = useXRReady();
  const noCamera = theremin.entered && !camera;
  // The readout dims when nothing sounds.
  const quiet = useQuiet();

  const buttons: DockButton[] = [
    theremin.session
      ? {
          id: "songs",
          label: "Stop song",
          icon: <StopIcon />,
          on: true,
          act: stopSong,
        }
      : {
          id: "songs",
          label: "Songs",
          icon: <NoteIcon />,
          on: theremin.songCard,
          act: () => {
            theremin.songCard = !theremin.songCard;
            theremin.finish = null;
            closeHowTo();
            theremin.changed();
          },
        },
    {
      id: "mode",
      label: `Pitch: ${PITCH_MODE_LABEL[theremin.mode]}`,
      icon: <ModeIcon />,
      mark: MODE_MARK[theremin.mode],
      act: nextMode,
    },
    {
      id: "view",
      label: VIEW_LABEL[theremin.view],
      icon: <ViewIcon />,
      mark: VIEW_MARK[theremin.view],
      act: nextView,
    },
    {
      id: "light",
      label: theremin.night ? "Night" : "Day",
      icon: theremin.night ? <MoonIcon /> : <SunIcon />,
      act: () => setNight(!theremin.night),
    },
    {
      id: "howto",
      label: "How to play",
      icon: <HelpIcon />,
      on: theremin.howTo,
      act: () => {
        if (theremin.howTo) {
          closeHowTo();
          return;
        }
        theremin.howTo = true;
        theremin.songCard = false;
        theremin.changed();
      },
    },
  ];

  return (
    <Html
      fullscreen
      calculatePosition={pinToScreen}
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "none" }}
    >
      <style>{CSS}</style>
      <style>{SONG_CSS}</style>
      <div className="vl-root">
        {noCamera ? (
          <div
            className="vl-nocam vl-glass"
            data-hud="no-camera"
            role="status"
            style={{
              right: GUTTER,
              top: GUTTER,
              width: Math.min(frame.width, 220),
            }}
          >
            <NoCameraIcon />
            <span>{NO_CAMERA}</span>
          </div>
        ) : null}
        <CameraGuides
          rect={frame}
          screen={{ width, height }}
          shown={theremin.started && !hidden && !noCamera}
        />
        <button
          type="button"
          data-hud="camera"
          className={`vl-cam ${hidden || noCamera ? "vl-gone" : ""}`}
          aria-label="Hide your camera"
          style={{
            left: frame.left,
            top: frame.top,
            width: frame.width,
            height: frame.height,
          }}
          onClick={toggleCam}
        />
        <button
          type="button"
          data-hud="camera-show"
          className={`vl-btn vl-glass vl-show ${hidden && !noCamera ? "" : "vl-gone"}`}
          aria-label="Show your camera"
          onClick={toggleCam}
        >
          <CameraIcon />
        </button>

        {theremin.howTo || leaving ? (
          <div
            className={`vl-howto-back ${theremin.howTo ? "" : "vl-leave"}`}
            data-hud="howto"
            role="presentation"
            onPointerDown={() => closeHowTo()}
          >
            <div
              className="vl-howto vl-glass"
              role="dialog"
              aria-label="How to play"
            >
              {theremin.howTo && until !== null ? (
                <div
                  className="vl-count"
                  aria-hidden="true"
                  style={
                    {
                      "--vl-count": `${INTRO_CARD_MS}ms`,
                    } as CSSProperties
                  }
                >
                  <div />
                </div>
              ) : null}
              {STEPS.map((st, i) => (
                <div className="vl-step" key={st.key}>
                  <span
                    className="vl-pic"
                    style={st.tint ? { color: st.tint } : undefined}
                  >
                    {st.pic}
                  </span>
                  <span>
                    <span className="vl-num">{i + 1}</span> {st.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {theremin.entered ? <SongUI width={width} height={height} /> : null}

        {theremin.entered ? (
          <div
            className={`vl-readout vl-glass ${quiet ? "quiet" : ""}`}
            data-hud="readout"
            role="status"
            aria-live="polite"
          >
            <span className="vl-mode">{PITCH_MODE_LABEL[theremin.mode]}</span>
            <span className="vl-note">{theremin.note}</span>
          </div>
        ) : null}

        <div
          className={`vl-dock vl-glass ${theremin.dockPulseAt !== null ? "pulse" : ""}`}
          data-hud="dock"
        >
          {buttons.map((b) => {
            const showTip = tapped === b.id;
            return (
              <button
                key={b.id}
                type="button"
                data-hud={b.id}
                className={`vl-btn ${b.on ? "on" : ""}`}
                aria-label={b.label}
                aria-pressed={b.on}
                onPointerUp={(e) => {
                  // On touch the label shows for a moment after the tap.
                  if (e.pointerType === "mouse") return;
                  setTapped(b.id);
                  window.clearTimeout(tapTimer.current);
                  tapTimer.current = window.setTimeout(
                    () => setTapped(null),
                    TAP_LABEL,
                  );
                }}
                onClick={b.act}
              >
                {b.icon}
                {b.mark ? <span className="vl-mark">{b.mark}</span> : null}
                <span className={`vl-tip vl-glass ${showTip ? "show" : ""}`}>
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Html>
  );
};
