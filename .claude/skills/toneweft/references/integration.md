# Wiring Toneweft into a game

The full API is in `node_modules/toneweft/README.md`. This is the shape that works for a game that
already has an `AudioContext`, buses and SFX.

```ts
import { Engine, parseSong, type Song } from 'toneweft';
import ashenText from '../music/ashen.song?raw';   // Vite raw import

const parsed = parseSong(ashenText);
if (!parsed.ok) throw new Error(parsed.errors.join('\n'));   // errors are line-numbered

// The host owns the context and resumes it on the first user gesture.
const ctx = new AudioContext();
const musicBus = ctx.createGain();
musicBus.connect(master);                 // the game's master chain (compressor etc.)

const trim = ctx.createGain();            // match the old music's loudness; measure, don't guess
trim.connect(musicBus);
const engine = new Engine(ctx, { destination: trim, masterChain: false });

engine.load(parsed.song);
engine.setLoop({ fromBar: 1, toBar: 32 }); // whole bars, inclusive; RangeError if out of range
engine.setLayerVolume('boss', 0);          // start with the boss layer silent
engine.play();

// Intensity change: same song, fade a layer.
engine.setLayerVolume('boss', 1, 1.5);

// Scene or game teardown.
engine.dispose();                          // leaves the AudioContext open
```

## Rules of thumb

- One `Engine` per music bus. Switch songs with `load()`; parse each song once and cache it.
- `masterChain: false` when the game already has a compressor/limiter, so music is not limited twice.
- Route music only to the music bus so the game's music volume and mute keep working. Toneweft has
  its own reverb; do not also send it into the game's reverb.
- `setLoop` and the layer volume survive across `play()`/`pause()`; `load()` clears the loop, layer
  volumes persist per layer name.
- `onEnded` fires only for a song that is not looping.
- Put the new path behind a flag first (for example a `?toneweft` URL parameter), keep the old music
  until every cue is written, and add a browser check that plays a cue, fades the boss layer, mutes,
  and stops.
- Never create an `AudioContext` at import time; browsers block audio until a user gesture.
