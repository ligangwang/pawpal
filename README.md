# Pawpal

萌宠伙伴. A virtual pet for [dingn](https://dingn.com): hatch a puppy, kitten,
fox or dragon, care for it every day, play mini-games together, and dress it
up and decorate its room. It will be at <https://dingn.com/play/pawpal/> once
dingn approves it.

## How it plays

- **Hatch and grow.** Pick a pet and name it. Tap the egg to hatch it. The pet
  grows from baby to kid after 3 days of care, and to grown-up after 7. Days
  count only when the player visits, so time away never sets it back.
- **Daily care.** Feed, Treat, Play, Bathe and Pet (or tap the pet). Food,
  fun, cleanliness and love drop slowly over real hours. A pet left alone
  looks sad and misses you, but it never gets sick or runs away.
- **Mini-games.** Treat Catch, Hide and Seek, and Dance Along win treats and,
  for signed-in players, dingn coins.
- **More pets.** Puppy and kitten are free. Fox and dragon eggs are in the
  shop, and each species is its own pet to raise.

## Coins

Earning (dingn coins, signed-in players):

| Source | Coins |
| --- | --- |
| First care of each day | 5, plus 1 per streak day, up to 10 |
| Each mini-game round | 1 to 10 by score |
| 15 badges (hatch, grow up, streaks, high scores, dress-up, decorating) | 265 in all |

Spending: 28 items in `game.json`'s `shop`, 4,550 coins in all. Players can
try outfits, decorations and wallpapers on before buying.

| Shelf | Items |
| --- | --- |
| Outfits | Bow, scarf, cap, glasses, flower crown, cape, wizard hat, crown (40 to 400) |
| Room | Rug, plant, painting, lamp, toy box, fish bowl, fairy lights, cloud bed (40 to 300) |
| Wallpaper | Mint, sky, peach (30 each), starry (120) |
| Helpers | Treat jar tiers 1 to 3 (free treats daily), cozy feeder (needs drop slower), play mat (+1 treat a round), growth snack (grows twice as fast) |
| New pets | Fox egg (200), dragon egg (400) |

Kid-friendly rules: basic care is always free, nothing is random or a loot
box, every item is bought once and kept, and dingn asks the player to confirm
each purchase.

## Develop

```sh
npm install
npm run dev     # http://localhost:5173/
npm test        # typecheck, unit tests and component tests
```

To play it inside dingn while developing, open the
[playground](https://dingn.com/developers/playground/) and load
`http://localhost:5173/`.

## Release a new version

1. In a pull request, raise `version` in `game.json`. Every release needs a
   new version.
2. Merge it. The **Build and publish** Action tests the game, builds
   `release/pawpal-<version>.zip` and uploads it to dingn with the
   `DINGN_UPLOAD_KEY` secret.
3. The new version waits in dingn's review queue and goes live once it is
   approved.

A merge that doesn't raise the version builds and tests but uploads nothing.
To upload by hand instead: `npm run pack`, then upload the zip on
<https://dingn.com/developers/games/>, or run
`DINGN_UPLOAD_KEY=... npm run upload`.

### The upload key

Create a key on <https://dingn.com/developers/games/> (signed in as the
account that owns the game), then add it to this repository under
**Settings → Secrets and variables → Actions** as `DINGN_UPLOAD_KEY`. dingn
shows the key once; if it is lost, revoke it and create another.

## The dingn SDK

`sdk/` is a copy of the dingn game SDK (`https://dingn.com/sdk/v1/`), bundled
into the game. Run `npm run update-sdk` to refresh it.

## Art

Everything is drawn in code: the room and pets from three.js shapes
(`src/pet-scene.ts`) and the flat faces as SVG (`src/pet-face.tsx`). There
are no third-party models, images or sounds.
