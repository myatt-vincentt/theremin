# Theremin

A theremin in a recording studio, played without touching it, the way a real one is. Your right
hand chooses the pitch, your left hand the volume. Two gold ghost hands play with you, glowing
rings around the antenna close in as the note rises, a sound wave rises from the cabinet, and
the studio's lights glow in the colour of your note. Your camera sits small in the top right
corner.

- **Start:** the home page shows while the studio and the theremin load; Start turns the sound
  on and asks for the camera. Without a camera the studio opens anyway and you play by
  dragging or with the keyboard.
- **Right hand, the pitch:** move it across the picture toward the antenna's side for higher
  notes, two octaves from C4 to C6. A ruler over your camera shows where each note is.
- **Left hand, the volume:** raise it to play louder, lower it to fade out; a fist goes quiet.
  With only the right hand in view, it plays at a medium volume.
- **Free or Scale:** Free glides like a real theremin; Scale settles on the notes of C major,
  so tunes are easier. The note you play shows under the dock.
- **Songs:** the music-note button opens the songs (Twinkle Twinkle, Ode to Joy, Amazing Grace,
  Brahms' Lullaby). A gold ring and a gold mark on the ruler show the note to find.
  **Learn** waits until you hold each note in tune; **Play** keeps time with a soft pad and
  gives 1 to 3 stars for staying in tune; **Slower** plays at three-quarter speed.
- **Without hands:** drag on the stage (across for pitch, up for volume); hold A–K for C4 to C5,
  Shift an octave up, ↑ ↓ for the volume.
- **The dock:** Songs, Pitch (Free / Scale), View (Front, Player, Close), Day / Night, How to
  play.

## Files

```
src/theremin/
  ThereminScene.tsx  the scene, loaded after the home page shows
  Home.tsx           the home page
  Hud.tsx            the dock and the how-to-play card
  CameraRig.tsx      the views, fitted to the screen (layout.ts)
  Studio.tsx         the room, its baked day / night light and the LEDs
  Theremin.tsx       the theremin, the rings, the halo, the sound wave and the meter
  GhostHands.tsx     the two gold hands (ghost.ts)
  Hands.tsx          hand tracking: pitch and volume (handPlay.ts, pitchZone.ts, oneEuro.ts)
  CameraGuides.tsx   the pitch ruler and volume bar over your camera
  pitch.ts           notes, the scale and the pitch range
  SongUI.tsx, SongPlayer.tsx, session.ts, songs.ts, holdJudge.ts, backing.ts   Learn and Play
  audio.ts           the theremin voice, made in code
  PointerInput.tsx   drags and keys
  CameraFrame.tsx    your camera in the corner
public/models/       the studio and its bakes, the theremin and the gold hand
```

Credits are in `CREDITS.md`.
