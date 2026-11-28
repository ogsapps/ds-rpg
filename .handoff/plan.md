## Goal

Wire the Toneweft music engine into Emberfall behind a flag, installed from GitHub the way a real
consumer would, without changing how the game plays or sounds when the flag is off.

- Install `toneweft` pinned to commit `b56a22726a90b230c19b635d63c77b1138b5c586`.
- Add a `music/` folder of `.song` files and a theme → song map.
- In `src/audio.ts`, when the flag is on, music comes from one Toneweft `Engine` on the existing
  music bus (`masterChain: false`); `playMusic(theme, intensity)` loads the theme's song, loops it,
  and maps `intensity` to the song's `boss` layer with a fade. The old sequencer is untouched and
  still used when the flag is off. SFX, buses, reverb, volume/mute and the public `audio` API
  stay exactly as they are.
- A browser check proves it in the built game.

## Files to touch

- `package.json`, `package-lock.json` — the `toneweft` dependency and one script
- `music/placeholder.song` — new
- `music/README.md` — new
- `src/music.ts` — new: flag, theme → song text map
- `src/audio.ts` — the Toneweft path
- `src/vite-env.d.ts` (or the existing env/types file) — only if needed for `?raw` imports
- `tools/music-check.mjs` — new browser check
- `README.md`, `AGENTS.md` — short notes

## Steps

1. Run `npm ci`. Then
   `npm install --save-exact "toneweft@github:Old-GenS/toneweft#b56a22726a90b230c19b635d63c77b1138b5c586"`.
   If that fails over git, use
   `"toneweft@git+https://github.com/Old-GenS/toneweft.git#b56a22726a90b230c19b635d63c77b1138b5c586"`.
   Never use an SSH URL. Confirm `node_modules/toneweft/dist/toneweft.js` and
   `node_modules/.bin/toneweft` exist (the package builds itself in `prepare`).

2. **`music/placeholder.song`**: copy `node_modules/toneweft/examples/demo.song` if it exists in
   the installed package; otherwise write this file exactly — it is Toneweft's demo song:
   ```text
   # Placeholder until the real Emberfall songs are written. Same as Toneweft's demo song.
   title: Emberfall Placeholder
   composer: SZ
   year: 2026
   source: original
   category: originals
   style: synthwave
   key: A minor
   tempo: 112
   time: 4/4

   track lead role=lead
   | A4/4 C5/4 E5/4 D5/4 | C5/4 B4/4 A4/2 | F4/4 A4/4 C5/4 B4/4 | A4/4 G4/4 A4/2 |
   | A4/4 C5/4 E5/4 G5/4 | F5/4 E5/4 D5/2 | C5/4 B4/4 A4/4 G4/4 | A4/1 |

   track pad role=pad
   | [A3 C4 E4]/1 | [A3 C4 E4]/1 | [F3 A3 C4]/1 | [F3 A3 C4]/1 |
   | [C4 E4 G4]/1 | [G3 B3 D4]/1 | [A3 C4 E4]/1 | [A3 C4 E4]/1 |

   track bass role=bass vol=0.45
   | A2/4 r/4 A2/4 E2/4 | A2/4 r/4 A2/4 E2/4 | F2/4 r/4 F2/4 C3/4 | F2/4 r/4 F2/4 C3/4 |
   | C3/4 r/4 C3/4 G2/4 | G2/4 r/4 G2/4 D3/4 | A2/4 r/4 A2/4 E2/4 | A2/4 r/4 A2/2 |

   track drums role=drums
   | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 |
   | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 |
   | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 |
   | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 | [k h]/8 h/8 h/8 h/8 [s h]/8 h/8 h/8 h/8 |

   track boss role=lead2 layer=boss
   | A4/1 | E5/2 C5/2 | C5/1 | A4/1 |
   | E5/1 | D5/1 | E5/2 C5/2 | A4/1 |
   ```
   Then `npx toneweft check music` must report it with 0 parse errors.

3. **`music/README.md`**: one short section: what the folder is; one `.song` per theme
   (`menu`, `map`, `ashen`, `whisper`, `frost`, `sanctum`, `throne`), each looping, with boss
   parts on `layer=boss`; currently every theme uses `placeholder.song`; commands
   `npx toneweft check music`, `npx toneweft balance music/<file>`,
   `npx toneweft audition music --host`; song format reference:
   `node_modules/toneweft/docs/song-format.md`.

4. **`src/music.ts`**:
   ```ts
   import type { ThemeId } from './audio';
   import placeholder from '../music/placeholder.song?raw';
   /** On with `?toneweft` in the URL or VITE_TONEWEFT=1 at build time. Off by default. */
   export const USE_TONEWEFT: boolean;
   /** Song text for each theme. Replace a theme's entry when its real song lands. */
   export const THEME_SONGS: Record<ThemeId, string>;  // every theme → placeholder for now
   ```
   `USE_TONEWEFT` = `import.meta.env.VITE_TONEWEFT === '1' || new URLSearchParams(location.search).has('toneweft')`.
   Avoid an import cycle with `audio.ts` at runtime (type-only import is fine). Add a
   `declare module '*.song?raw'` declaration if TypeScript needs one.

5. **`src/audio.ts` Toneweft path** (only active when `USE_TONEWEFT`):
   - New private fields: `tw: Engine | null`, `twTrim: GainNode`, a cache
     `Map<ThemeId, Song>` of parsed songs, and `twTheme: ThemeId | null` (the loaded theme).
   - In `init()`, after the buses exist: if `USE_TONEWEFT`, create
     `twTrim = ctx.createGain()` with `gain.value = TONEWEFT_TRIM` (a named module constant, see
     step 7), `twTrim.connect(this.musicBus)`, and
     `this.tw = new Engine(ctx, { destination: this.twTrim, masterChain: false })`. Do not send
     Toneweft into the game's reverb (it has its own). Then, where `init()` currently calls
     `startScheduler()` when music was requested before init, start the Toneweft path instead
     when it is on.
   - `playMusic(theme, intensity)`: keep the early return and the state updates. If Toneweft is
     on: never start the old scheduler. If `this.tw` exists:
     - theme differs from `twTheme`: parse with `parseSong` (cache it; on a parse error
       `console.error` once and fall back to the old scheduler for that call), `tw.load(song)`,
       `tw.setLoop({ fromBar, toBar })` over the whole song (first numbered bar to last:
       `song.bars` entries with `number >= 1`), `tw.setLayerVolume('boss', intensity ? 1 : 0)`
       (no fade), `tw.play()`, set `twTheme`.
     - same theme: `tw.setLayerVolume('boss', intensity ? 1 : 0, 1.5)`; if not playing,
       `tw.play()`.
   - `stopMusic()`: also `this.tw?.pause()` and set `twTheme = null` so the next `playMusic`
     reloads.
   - `setMusicLevel` needs no change (Toneweft feeds `musicBus`).
   - The old sequencer code, SFX code, bus/reverb setup and every public method signature stay
     as they are.
   - Debug hook: when `new URLSearchParams(location.search).has('audiodebug')`, set
     `(window as any).__emberfallAudio = audio` after `audio` is created. Nothing else is exposed.

6. **`tools/music-check.mjs`** + script `"check:music": "npm run build && node tools/music-check.mjs"`.
   Follow `tools/guard-check.mjs` for the static `dist/` server, Chromium candidates and
   playwright-core launch (headless, `--autoplay-policy=no-user-gesture-required`). In the page,
   use `window.__emberfallAudio` (`a`) and an `AnalyserNode` (fftSize 2048) connected from
   `a.musicBus` (private in TS, reachable at runtime); RMS = max over 50 ms samples of
   `getFloatTimeDomainData` within a window. Print one JSON line per check and a final
   `{"ok":...}`; exit 0 only if all pass; always close the browser and server.
   Open `<dist url>/?toneweft&audiodebug`, call `await a.init()` from `page.evaluate` (after a
   click on `body`), then:
   - `engine`: `a.tw` is not null.
   - `plays`: `a.playMusic('ashen')`, wait 1.5 s → `a.tw.playing === true`, `a.tw.loop !== null`,
     RMS over 1 s > 0.001, and `a.timer === null` (old scheduler not running).
   - `boss`: `a.playMusic('ashen', true)`, wait 2 s → `a.tw.getLayerVolume('boss') === 1`;
     `a.playMusic('ashen', false)`, wait 2 s → `0`.
   - `switch`: `a.playMusic('map')` → after 1 s `a.twTheme === 'map'` and `a.tw.playing`.
   - `mute`: `a.setMusicLevel(0)`, wait 1 s → RMS over 0.5 s < 0.0005; `a.setMusicLevel(1)`.
   - `stop`: `a.stopMusic()`, wait 0.5 s → `a.tw.playing === false`.
   - `level`: report only (always passes): RMS of `ashen` over 3 s with Toneweft, and in a second
     page opened at `<dist url>/?audiodebug` (flag off) the RMS of the old sequencer's `ashen`
     over 3 s; print both and their ratio in dB.
   - `flag-off`: in that second page, `a.tw === null` after `a.playMusic('ashen')` and the old
     scheduler runs (`a.timer !== null`).

7. **Level trim.** Run `npm run check:music` once with `TONEWEFT_TRIM = 1`. Set `TONEWEFT_TRIM`
   to `10 ** (-dB / 20)` rounded to 2 decimals so Toneweft's `ashen` RMS matches the old
   sequencer's within ±1 dB (where `dB` is Toneweft minus old), clamped to `[0.1, 2]`. Re-run and
   record both runs' `level` lines in the report. Put a one-line comment above the constant
   saying it matches the old sequencer's loudness on the music bus.

8. **Docs**: `README.md` — a short "Music (Toneweft, experimental)" note: add `?toneweft` to the
   URL to hear it, songs live in `music/`, the commands from step 3, the dependency is pinned to a
   commit. `AGENTS.md` — a short section: music comes from `music/*.song` via Toneweft behind
   `USE_TONEWEFT`; check new songs with `npx toneweft check music` and `npx toneweft balance`;
   run `npm run check:music` after audio changes; do not edit `node_modules/toneweft`; upgrade by
   changing the pinned commit.

## Acceptance

Run from the repo root, in order:

1. `grep -n '"toneweft"' package.json` shows the dependency pinned to
   `b56a22726a90b230c19b635d63c77b1138b5c586` (github: or git+https form).
2. `npx toneweft check music` exits 0 and prints `placeholder.song` and `0 parse errors`.
3. `npx toneweft balance music/placeholder.song` exits 0 and prints the per-section table.
4. `npm test` exits 0 (balance targets unchanged).
5. `npm run build` exits 0.
6. `npm run check:music` exits 0 and its last line is `{"ok":true}`; the `level` line shows the
   two RMS values within ±1 dB after the trim.
7. `rm -rf node_modules && npm ci && npm run build` exits 0 (a clean install from the lockfile
   fetches and builds the GitHub dependency).
8. `git status --porcelain` lists only files from **Files to touch** (plus `.handoff/`).

## Parallel work

None — do it sequentially.

## Constraints

- Do not commit, push, or switch branches.
- A step may touch a file outside **Files to touch** when it has to; list every such file in the
  report under "outside the plan", one line each saying why.
- This is not a balance-tuning task: do not change any gameplay number, `docs/balance.md`,
  `tools/balance/` or `config` values. `npm test` must pass unchanged.
- With the flag off the game must behave and sound exactly as before: no change to the old
  sequencer, SFX, buses, reverb, volume curves or public `audio` methods.
- Do not edit anything under `node_modules/`. No dependency other than `toneweft`.
- Network is HTTP/HTTPS only through a proxy; never use SSH URLs.
- Run one browser at a time. Headless Chromium is at
  `/usr/lib64/chromium-browser/chromium-browser` or `/usr/bin/chromium-browser`.
- The only checks to run are the **Acceptance** commands (and the one extra `check:music` run in
  step 7); don't write or run extra end-to-end tests. If something outside Acceptance fails, note
  it in the report and finish.

## Out of scope

- Writing the real Emberfall songs (they come next, one per theme).
- Turning the flag on by default or removing the old sequencer.
- Crossfading between themes, victory/defeat stingers, SFX changes.
- Any Toneweft change.

## If blocked

- If the GitHub install cannot be fetched or `prepare` fails, stop and report the exact npm
  error.
- If TypeScript 5.6 cannot read Toneweft's `.d.ts` files, report the exact errors and stop; do
  not add `skipLibCheck` or edit the package.
- If headless Chromium produces no analyser signal (RMS 0 everywhere), finish everything else,
  mark Acceptance 6 blocked with the numbers, and finish.
- If an Acceptance command fails for a reason outside this plan, record the output and finish.
