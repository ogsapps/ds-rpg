# Composing with Toneweft

Practical craft notes for writing `.song` files that sound good, not just parse. The syntax is in
`node_modules/toneweft/docs/song-format.md`.

## Draft order

1. **Harmony first**: write the pad (or chords) and bass for the whole loop, one chord per bar or
   two. Add a `# chords:` line with the same progression so `check` can flag off-chord notes.
2. **Melody**: the lead where it should be present. Leave bars without a lead; a melody that never
   rests tires the ear (`report` flags "never rests").
3. **Rhythm**: drums at the density the game state needs. A menu or map often needs none or a soft
   pulse; a battle needs a kit; a boss needs more.
4. **Layers**: put everything that should come and go with intensity on a named layer.
5. **Shape**: vary the loop. Change the drum pattern or lead every 4–8 bars, drop a part for a few
   bars, add a fill before the loop wraps. `report` shows how many bars of each track are unique;
   a very low number means a loop that will grate after a minute.

## Voicing and ranges

- Keep the bass alone below about C3 and the pad mostly in C3–C5, so the low end stays clean.
- Put the lead above the pad. A counter or lead2 line in the same octave as the lead gets masked.
- Spread chords: root and fifth low, third higher (`[D3 A3 F4]`) sounds fuller than a close triad.
- Stay inside each role's range; the parser rejects notes outside it.

## Boss / intensity layers

The game fades the layer in over a second or two while the base keeps playing, so the layer must be
written to fit on top of every bar of the loop.

- Add energy, not decoration: double-time hats or toms, crash on bar 1 of each phrase, low brass
  or power stabs on the chord changes, a high line above the lead.
- Test it both ways: the base alone must still work, and base + boss must not mask the lead.
  `balance` renders every layer at full volume, so the numbers show the boss-on mix.

## Loops and seams

- The loop region is whole bars. A pickup bar (bar 0) is never part of a loop.
- Make the last bar of the loop lead into its first: a turnaround chord, a drum fill, a melodic
  pickup into the downbeat.
- Notes that start before the loop end ring out across the seam; they are not cut. A long reverb
  pad over the seam is fine.
- An intro outside the loop (for example bars 1–4, loop 5–32) plays once, then the loop repeats.

## Levels

- Default track `vol` is 0.8. Set `vol=` per track to fix a balance flag; `vol.<style>=` changes
  one style only.
- `vol@N=X` / `vol@N-M=A..B` automate a track over bars (fade a pad in, drop the drums for a break).
- Use velocity (`v=80`, `:120`) for accents and dynamics inside a part; a flat velocity everywhere
  sounds mechanical (`report` flags it).

## Reading the checks

- `check`: a clash is a long note a semitone from the pad or bass under it. A few are normal
  (passing notes, a maj7); a spike usually means a wrong note or a wrong chord in the pad.
- `report`: density per track, register, velocity spread, unique bars and an 8-bar energy map.
  Use it to see whether the song builds and breathes.
- `balance`: each cell is `<playing loudness>/<peak>` per section. Flags name buried or too-loud
  parts and suggest a `vol=`. Fix the song; do not add `# balance-ok` unless the imbalance is a
  choice you can explain.
