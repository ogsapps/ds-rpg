# Emberfall — Legends of the Shattered Vale

A handcrafted, single-page browser RPG and auto-battler. Choose one of four heroes, cross five ruined realms, collect boons, and put the Ashen King back in the ground.

**Play:** once the included GitHub Pages workflow finishes, the game is live at **https://old-gens.github.io/Emberfall/**.

Everything you see and hear is original. Painted unit art, combat effects, realm backdrops and hero portraits ship in `public/assets/`, over procedural canvas layers and code-drawn vector fallbacks. The soundtrack and every sound effect are synthesized live with the Web Audio API. If the painted art is absent or fails to load, the game falls back to its code-drawn units and runs fully procedurally.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build into dist/
npm run preview  # preview the production build
npm test         # balance targets and config hash against docs/balance.md (about 10 s)
npm run balance  # the balance report: tiers × classes, per-stage tables, sweeps
```

Requires Node 20+. Click once anywhere and the music begins (browser autoplay rules).

## Music (Toneweft, experimental)

Add `?toneweft` to the URL to hear music from the [Toneweft](https://github.com/Old-GenS/toneweft) engine instead of the built-in sequencer; without it the game plays and sounds exactly as before. Songs live in `music/` as one looping `.song` per theme, with boss parts on the `boss` layer. Check songs with `npx toneweft check music` and `npx toneweft balance music/<file>`, audition them with `npx toneweft audition music --host`, or test the wired-in path with `npm run check:music`. The dependency is pinned to commit `b56a22726a90b230c19b635d63c77b1138b5c586`.

## How it plays

- **Pick a hero.** Each class has its own passive, three auto-cast skills, and a charged ultimate.
- **Combat is automatic.** The hero attacks and casts on cooldown. You decide when to spend the ultimate, and when to make the next run.
- **Five realms × five stages.** Every realm has a unique palette, bestiary, music theme and a boss at stage five.
- **Boons after every victory.** Three random choices; commons, rares, and class-specific epics. They stack for the whole run.
- **No death penalty.** Retry a stage as many times as you like. Each defeat grants a small Rally bonus for the next attempt.
- **Auto-save.** Progress is stored in `localStorage`. The title screen can resume, reset, or start a new run.

### Classes

| Class | Role | Signature |
| --- | --- | --- |
| The Warden | Armored guardian | Shields, stuns, damage reflection |
| The Pyromancer | Glass cannon | Burn damage, AoE nukes, meteors |
| The Shadowblade | Assassin | Poison, bleeds, guaranteed critical ultimate |
| The Spiritcaller | Sustain | Regeneration, healing, a summoned spirit wolf |

### Controls

| Input | Action |
| --- | --- |
| Click / tap | Menus, choose boons, unleash ultimate |
| `Space` or `1`–`3` | Release the ultimate when charged |
| `Esc` | Pause / resume |
| Speed button | Toggle 1× / 2× battle speed |
| Phone | Portrait keeps the controls at the bottom of the screen; landscape puts them beside the scene. Skill and boon descriptions are shown inline instead of on hover |

## Tech

- TypeScript + Vite, with Toneweft as the one (experimental, opt-in) runtime dependency.
- Canvas 2D renderer: painted unit sprites over procedural parallax backgrounds, with code-drawn vector fallbacks, particles and floating combat text.
- Web fonts bundled locally (Cinzel, Cormorant Garamond, Inter) — no external font CDN.
- Web Audio synthesis: five original generative tracks (one per realm) plus a title/map theme, with reverb, pads, plucked arps, leads and drums; all SFX are synthesized too.
- DOM/CSS UI for menus, map, loadout and results.
- `src/balance.ts` holds every tunable number; `tools/balance/` is a headless harness that plays the real game on seeded dice (see `docs/balance.md`).
- `localStorage` save file, no backend.
- GitHub Actions → GitHub Pages deployment.

## Project layout

```
src/
  main.ts       game flow, screens, battle loop, input
  combat.ts     deterministic-ish auto-battler engine (stats, statuses, AI)
  data.ts       classes, abilities, boons, enemies, realms
  balance.ts    every tunable number (scaling, XP, ultimate charge, Rally, enrage)
  art.ts        procedural canvas art, SVG portraits/emblems
  audio.ts      Web Audio music sequencer and SFX
  state.ts      save data, XP/levels, boon rolls
  ui.ts         screen templates and icon set
  sprites/      painted art loading, registration and fallbacks
  style.css     visual design
public/assets/  ships with the game: units, fx, realms, portraits, fonts, ui
tools/balance/  seeded headless harness over the real engine: tiers, targets, tables, sweeps
tools/units/    art pipeline: background removal, trim, foot anchor, WEBP + manifest
docs/balance.md  the balance record: targets, results, proposals, how to retune
docs/unit-art.md  the prompt pack and framing rules for generating unit art
```

## Art

Painted art is additive: any unit without an image keeps its code-drawn fallback, so art can land a few pieces at a time.

Originals live in `art/units/<id>.png` (git-ignored) as 1024×1024 PNGs on a flat green `#00FF00` background — magenta `#FF00FF` for units that are themselves green. `npm run units:prepare` removes the background, trims, finds the feet and writes `public/assets/units/<id>.webp` plus `manifest.json`. An optional `<id>-attack.webp` in the same framing is cross-faded in during attacks.

`docs/unit-art.md` holds the per-unit prompts, the shared style block and the framing rules.

## Install & play offline

- **Chrome / Edge / Android:** use the browser's **Install app** option (from the address bar or the menu).
- **iOS:** open the site in Safari, tap **Share**, then **Add to Home Screen**.
- After the first visit the whole game is cached, so it plays offline — including every image and font.
- When a new version is deployed, a **Reload** toast appears (never during a battle). Reload when you are ready.
- Saves stay in the browser's `localStorage`; they are not uploaded anywhere.

## Deployment

Pushes to `main` (or `master`) build and deploy through `.github/workflows/deploy.yml`. In the repository settings, set **Pages → Source** to **GitHub Actions**. The Vite base is relative (`./`), so it works from a project subpath.

## Notes

- Balance is measured, not assumed: `docs/balance.md` records the targets and the current results, and `npm test` checks them. After a first balance pass, bosses occasionally need a retry for the Pyromancer and Shadowblade, the ultimate is Ready in most fights and pressing it matters, and nobody can get stuck. The Warden and Spiritcaller never lose a boss, and the Warden takes about three times as long to win one; the doc has the numbers, what was changed, and what remains.
- Battles never stall: after 70 seconds a soft enrage increases all damage.
- Audio is optional and can be toggled separately for music and effects.
