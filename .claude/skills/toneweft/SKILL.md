---
name: toneweft
description: Compose, check and wire in music for a browser game or app with Toneweft, a text-score Web Audio engine. Use when the user asks to write, revise or audition game music or a `.song` file, add music or a soundtrack to a project that has `toneweft` in package.json, make a boss/intensity layer, loop a track, or play music with `Engine`, `setLoop` or `setLayerVolume`.
---

# Toneweft

Toneweft plays music written as plain-text `.song` scores through synthesized instruments. No
audio files. An agent writes the score; the CLI checks it; a person listens and leaves notes; the
agent revises. You cannot hear the music, so the checks plus the person's notes are your ears.

## Before you start

1. Confirm the package is installed: `node_modules/toneweft/` exists and `npx toneweft --help`
   works. If not, install it from GitHub pinned to a commit:
   `npm install "toneweft@github:Old-GenS/toneweft#<commit>"`, plus `npm install -D vite` for the
   `balance` and `audition` commands.
2. Read the installed docs that match this version:
   - `node_modules/toneweft/docs/song-format.md` — full syntax (required before writing a song)
   - `node_modules/toneweft/docs/workflow.md` — the composing workflow and cue-sheet template
   - `node_modules/toneweft/README.md` — the `Engine` API
3. Find where the project keeps songs (often `music/`) and any cue sheet. If there is no cue sheet,
   write one (template in `workflow.md`) and get the user's agreement before writing notes.

## The loop

1. **Cue sheet** — one brief per song: game state, mood, tempo, key/mode, bars, loop bars, layers
   and what each adds, style.
2. **Write the `.song`** — see the cheat sheet below and [references/composing.md](references/composing.md).
3. **Check** — all must be clean before you hand it over:
   ```bash
   npx toneweft check music                 # parse errors fail; reports clashes, off-chord notes
   npx toneweft report music/<song>.song    # density, register, repetition, energy per section
   npx toneweft balance music/<song>.song   # per-track loudness vs the lead, per section
   ```
4. **Listen** — the person runs `npx toneweft audition music --host` (cue cards, Seam button for
   the loop point, layer toggles, notes box) or hears it in the game. Notes are saved to
   `music/notes.md`.
5. **Revise** from `notes.md` and the check output, then check again.
6. **Wire it in** — [references/integration.md](references/integration.md).

## Song cheat sheet

```text
title: Ashen Reach
composer: <name>
year: 2026
source: original
category: originals
style: cinematic          # synthwave chiptune orchestral techno lofi cinematic altrock ambient studio
key: D minor
tempo: 96
time: 4/4

# The next line is the chord map: one symbol per bar, cycling. Nothing else on that line.
# chords: Dm Dm Bb C

track pad role=pad
| [D3 F3 A3]/1 | % | [Bb2 D3 F3]/1 | [C3 E3 G3]/1 |

track bass role=bass vol=0.36
| D2/4 r/4 D2/8 D2/8 A1/4 | % | Bb1/4 r/4 Bb1/8 Bb1/8 F2/4 | C2/4 r/4 C2/8 C2/8 G1/4 |

track drums role=drums
| [k h]/8 h/8 [s h]/8 h/8 [k h]/8 [k h]/8 [s h]/8 h/8 | % | % | % |

track brass role=counter layer=boss
| D3/2 F3/2 | D3/1 | Bb2/2 D3/2 | C3/1 |
```

- Notes `C4/4`, rests `r/4`, chords `[C4 E4 G4]/2`, `%` repeats a bar, `{ ... }*n` repeats bars.
  Durations `/1 /2 /4 /8 /16 /32`, `.` dotted, `t` triplet; a note without a duration reuses the
  last one. `~` ties, `^` bends, `'` staccato, `:110` velocity for one note, `v=90` for following
  notes, `+18`/`-10` ticks of micro-timing.
- Every bar must add up to the time signature, and every track needs the same number of bars.
- Roles: `lead lead2 counter pad chords bass arp drums`, each with a pitch range (bass C1–C4,
  pad C2–C6, lead C3–C7; full table in `song-format.md`). Drums: `k rim s cl tl h tm oh cr th rd`.
- `layer=<name>` (default `base`) groups tracks for `setLayerVolume`; `boss` is the convention for
  intensity.

## Rules

- Never silence a check to pass it. `# ok @<bar> <track> <note>: <reason>` and
  `# balance-ok @<bars> <track>: <reason>` are only for deliberate choices you can name in musical
  terms; tell the user each one you add. A failing check reported honestly beats a song bent to pass.
- A boss/intensity layer must change the energy — extra drums, low brass or stabs, a louder line
  above the lead — not add one quiet voice. Run `balance` and look at the layer's column.
- Loops start and end on bar boundaries, and the last bar must lead back into the loop's first bar.
  Ask the person to check it with the audition page's **Seam** button.
- Leave headroom for sound effects: music sits under SFX in the game's mix.
- Do not edit `node_modules/toneweft`. Engine bugs or missing features go to the Toneweft repo.
- Report what you could not verify: you have not heard the song; say so and ask for a listen.
