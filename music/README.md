# Music

This folder holds Emberfall's songs in Toneweft's text `.song` format. Each theme gets one
`.song` file (`menu`, `map`, `ashen`, `whisper`, `frost`, `sanctum`, `throne`), written to loop,
with any boss-only parts on tracks marked `layer=boss`. Until the real songs are written, every
theme uses `placeholder.song`.

## Commands

```sh
npx toneweft check music                 # parse and clash checks
npx toneweft balance music/<file>        # per-section level table
npx toneweft audition music --host       # audition all songs in the browser
```

The song format reference is `node_modules/toneweft/docs/song-format.md`.
