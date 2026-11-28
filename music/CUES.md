# Emberfall cue sheet

The plan for the Toneweft songs in this folder. One looping `.song` per theme; the game plays it
with `audio.playMusic(theme, intensity)`, and `intensity` (boss stages) fades the song's
`layer=boss` tracks in over 1.5 s. Keys, modes and tempos come from the old sequencer's themes in
`src/audio.ts`, so each realm stays recognisable.

| Cue | Plays on | Key / mode | BPM | Bars (loop) | Style | Mood and base layer | Boss layer adds |
|---|---|---|---|---|---|---|---|
| `menu` | title, class select, victory | D minor | 72 | 32 (5–32) | ambient | Embers of a dead kingdom: sparse piano-like lead, wide pad, no drums. A 4-bar intro, then the main motif. | — (no boss) |
| `map` | map between battles, rewards | E major (pentatonic tune) | 78 | 32 (1–32) | orchestral | Hopeful travelling music: rising arpeggio, warm strings, light frame drum | — |
| `ashen` — The Ashen Reach | realm 1 | D minor | 96 | 48 (1–48) | cinematic | Smouldering and driving: saw pad, pulsing bass, steady kick, a falling ember motif | Toms and hits on each beat, low brass stabs, the motif doubled an octave up — The Molten Warden |
| `whisper` — The Whisperwood | realm 2 | A Dorian | 84 | 48 | ambient | The forest is listening: plucked arpeggio, breathy lead, soft hand percussion, uneasy space | A hissing shaker pulse, a low drone, a darting counter-line — The Pale Stag |
| `frost` — The Frostveil Peaks | realm 3 | E minor | 90 | 48 | cinematic | Silence carved in ice: bell-like arpeggio, glassy pad, a motif that descends from high E, sparse drums | Driving 8th-note strings, timpani rolls, a choir-like pad — The Winter's Herald |
| `sanctum` — The Sunken Sanctum | realm 4 | C# harmonic minor | 76 | 48 | orchestral | What the tide kept: a slow, sea-swell hymn with organ-like chords and a deep slow bass | Low brass in harmonic minor, an insistent hand drum, a high wailing line — The Leviathan Eye |
| `throne` — The Ember Throne | realm 5, final boss | C Phrygian | 118 | 64 | cinematic | The last light before the dark: urgent, square-ish lead, galloping bass, full kit, the ♭2 (D♭) everywhere | Everything doubled: crash accents, a brass octave line, double-time hats — the Ashen King |

## Rules for every song

- The loop wraps cleanly to its first loop bar (listen with the audition page's **Seam** button).
- A boss layer must change the energy, not add one quiet voice: extra drums, low brass or stabs, a
  louder line above the lead. The demo's single quiet boss line was too subtle.
- Leave headroom for SFX; the music bus trim (`TONEWEFT_TRIM` in `src/audio.ts`) is set to the old
  sequencer's loudness.
- Each song passes `npx toneweft check music` and `npx toneweft balance music/<file>` with the boss
  layer on (the balance render plays every layer).

## Order

1. `menu` and `ashen` first (first thing a player hears; first boss layer). Listen in game with
   `?toneweft`, write notes, revise.
2. Then `map`, `whisper`, `frost`, `sanctum`, `throne` in the voice that was approved.
3. Wire each into `THEME_SONGS` in `src/music.ts` as it lands.
4. Later: victory/defeat stingers, turning `USE_TONEWEFT` on by default, removing the old sequencer.

## Tools

```bash
npx toneweft check music
npx toneweft report music/<file>.song
npx toneweft balance music/<file>.song
npx toneweft audition music --host
npm run check:music
```

Song format: `node_modules/toneweft/docs/song-format.md`. Workflow:
`node_modules/toneweft/docs/workflow.md`.
