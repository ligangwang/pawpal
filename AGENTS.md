# AGENTS.md

Notes for AI coding agents working on Pawpal.

- This is a dingn game published like any outside developer's game: the
  dingn website (repo `ligangwang/dingn`) runs it in a sandboxed frame and the
  game talks to it only through the SDK in `sdk/`. Don't import from the
  dingn repo. Refresh `sdk/` with `npm run update-sdk`.
- Run `npm test` before committing. `npm run pack` builds the upload zip.
- Merging to `main` publishes on dingn (`.github/workflows/release.yml`)
  when `version` in `game.json` is new.
- Bump `version` in `game.json` for every release; dingn refuses a version it
  already has.
- Save with `sdk.storage` / `sdk.progress`, never `localStorage` or cookies,
  which the sandbox blocks. Keep every URL relative (`base: "./"`).
- UI strings go through `t()` with translations in `src/zh-CN.json`.
- All art is drawn in code (three.js shapes in `src/pet-scene.ts`, SVG in
  `src/pet-face.tsx`), so the game ships no model or image files. Keep new
  art original.
- The shop lives in `game.json` (`shop`, at most 30 items, each bought once).
  Item ids start with `pet-`, `outfit-`, `decor-` or `wall-` to pick their
  shelf; anything else is a helper read by `perksFrom` in `src/pet-shop.ts`.
- Keep it kind to kids: basic care stays free, nothing is random, and coins
  buy looks and conveniences, never a win.
