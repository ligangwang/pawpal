import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  care,
  dailyCoins,
  dayKey,
  finishRound,
  FLOOR,
  GROWN_DAYS,
  HATCH_TAPS,
  KID_DAYS,
  mood,
  newerHome,
  newPet,
  NO_PERKS,
  petBadges,
  readHome,
  roundBadges,
  roundPrize,
  stage,
  tapEgg,
  tick,
  wish,
  type Pet,
} from "../src/pet-core";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const start = new Date(2026, 10, 15, 9).getTime();
const hatched = (): Pet => {
  let pet = newPet("puppy", "  Biscuit  ", start);
  for (let i = 0; i < HATCH_TAPS; i++) pet = tapEgg(pet, start);
  return pet;
};

test("an egg hatches after a few taps", () => {
  let pet = newPet("kitten", "Mochi", start);
  assert.equal(stage(pet), "egg");
  for (let i = 1; i < HATCH_TAPS; i++) pet = tapEgg(pet, start);
  assert.equal(pet.hatched, false);
  pet = tapEgg(pet, start);
  assert.equal(pet.hatched, true);
  assert.equal(stage(pet), "baby");
});

test("names are trimmed and kept short", () => {
  assert.equal(hatched().name, "Biscuit");
  assert.equal(newPet("fox", "A very very long fox name", start).name.length, 16);
});

test("needs drop over time but never below the floor", () => {
  const pet = hatched();
  const later = tick(pet, start + 2 * HOUR);
  assert.equal(later.needs.food, pet.needs.food - 12);
  const away = tick(pet, start + 30 * DAY);
  for (const v of Object.values(away.needs)) assert.equal(v, FLOOR);
  assert.equal(mood(away), "sad");
  assert.equal(wish(away) !== null, true);
});

test("an egg's needs don't drop", () => {
  const egg = newPet("fox", "Ember", start);
  assert.deepEqual(tick(egg, start + 10 * DAY).needs, egg.needs);
});

test("the cozy feeder slows hunger and mess", () => {
  const pet = hatched();
  const slow = tick(pet, start + 4 * HOUR, { ...NO_PERKS, feeder: true });
  assert.equal(slow.needs.food, pet.needs.food - 18);
  assert.equal(slow.needs.fun, pet.needs.fun - 20);
});

test("feeding a full pet does nothing; treats need treats", () => {
  let pet = hatched();
  pet = { ...pet, needs: { ...pet.needs, food: 99 }, treats: 0 };
  assert.equal(care(pet, "feed", start).done, false);
  assert.equal(care(pet, "treat", start).done, false);
  assert.equal(care(pet, "pet", start).done, true);
});

test("care counts days, builds a streak and grows the pet", () => {
  let pet = hatched();
  let grewInto: string[] = [];
  for (let d = 0; d < GROWN_DAYS; d++) {
    const first = care(pet, "pet", start + d * DAY);
    assert.equal(first.newDay, true);
    const second = care(first.pet, "feed", start + d * DAY + HOUR);
    assert.equal(second.newDay, false);
    if (first.grew) grewInto.push(first.grew);
    pet = second.pet;
  }
  assert.equal(pet.careDays, GROWN_DAYS);
  assert.equal(pet.streak, GROWN_DAYS);
  assert.deepEqual(grewInto, ["kid", "grown"]);
  assert.equal(stage(pet), "grown");
  // Missing a day starts the streak again but keeps the best.
  pet = care(pet, "pet", start + (GROWN_DAYS + 1) * DAY).pet;
  assert.equal(pet.streak, 1);
  assert.equal(pet.bestStreak, GROWN_DAYS);
});

test("the growth snack doubles care days and the treat jar gives treats", () => {
  const pet = hatched();
  const perks = { jar: 2, feeder: false, mat: false, vitamins: true };
  const r = care(pet, "pet", start, perks);
  assert.equal(r.pet.careDays, 2);
  assert.equal(r.pet.treats, pet.treats + 2);
  const r2 = care(r.pet, "pet", start + DAY, perks);
  assert.equal(r2.pet.careDays, 4);
  assert.ok(r2.pet.careDays >= KID_DAYS && r2.grew === "kid");
});

test("daily coins grow with the streak up to 10", () => {
  assert.equal(dailyCoins(1), 5);
  assert.equal(dailyCoins(3), 7);
  assert.equal(dailyCoins(40), 10);
});

test("a mini-game round always pays something, coins at most 10", () => {
  assert.equal(roundPrize("catch", 0).coins, 0);
  assert.ok(roundPrize("catch", 0).fun > 0);
  assert.deepEqual(
    [roundPrize("catch", 3).coins, roundPrize("catch", 100).coins],
    [1, 10],
  );
  const pet = hatched();
  const r = finishRound(pet, "seek", 4, start, { ...NO_PERKS, mat: true });
  assert.equal(r.pet.treats, pet.treats + r.prize.treats);
  assert.equal(r.prize.treats, roundPrize("seek", 4).treats + 1);
});

test("badges follow the pet and the scores", () => {
  const pet = { ...hatched(), careDays: KID_DAYS, bestStreak: 7, outfit: "outfit-bow" };
  assert.deepEqual(petBadges(pet), ["hatched", "kid", "streak-3", "streak-7", "dress-up"]);
  assert.deepEqual(roundBadges("catch", 41), ["catch-20", "catch-40"]);
  assert.deepEqual(roundBadges("dance", 5), []);
});

test("saves are read safely and the newest one wins", () => {
  assert.equal(readHome(null), null);
  assert.equal(readHome({ pets: [{ species: "cat" }] }), null);
  const pet = hatched();
  const old = readHome(JSON.parse(JSON.stringify(pet)))!;
  assert.equal(old.pets.length, 1);
  const home = readHome({ pets: [pet, { ...pet, at: start + 5 }, { ...pet, species: "fox" }], active: 9 })!;
  assert.deepEqual(home.pets.map((p) => p.species), ["puppy", "fox"]);
  assert.equal(home.active, 0);
  const odd = readHome({ species: "dragon", name: "X", needs: { food: 900 }, decor: [1, "decor-rug"] })!;
  assert.equal(odd.pets[0].needs.food, 100);
  assert.deepEqual(odd.pets[0].decor, ["decor-rug"]);
  const later = { pets: [{ ...pet, at: start + HOUR }], active: 0 };
  assert.equal(newerHome(home, later), later);
});

test("day keys are local calendar days", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23).getTime()), "2026-01-05");
});

test("game.json: badges, shop and limits", () => {
  const g = JSON.parse(readFileSync("game.json", "utf8"));
  const coins = { bronze: 10, silver: 25, gold: 50, diamond: 100 } as Record<string, number>;
  assert.ok(g.badges.length <= 50);
  assert.ok(g.badges.reduce((n: number, b: { tier: string }) => n + coins[b.tier], 0) <= 1000);
  assert.ok(g.shop.length <= 30);
  const ids = new Set<string>();
  for (const item of g.shop) {
    assert.ok(item.price >= 1 && item.price <= 1000, item.id);
    if (item.requires) assert.ok(ids.has(item.requires), item.id);
    ids.add(item.id);
  }
  const badgeIds = new Set(g.badges.map((b: { id: string }) => b.id));
  const used = [
    ...petBadges({ ...hatched(), careDays: 99, bestStreak: 99, outfit: "x", decor: ["a", "b", "c"], needs: { food: 100, fun: 100, clean: 100, love: 100 } }),
    ...roundBadges("catch", 99),
    ...roundBadges("seek", 99),
    ...roundBadges("dance", 99),
  ];
  assert.deepEqual(new Set(used), badgeIds);
});

test("every UI string has a Chinese translation", () => {
  const zh = JSON.parse(readFileSync("src/zh-CN.json", "utf8"));
  const missing: string[] = [];
  for (const file of readdirSync("src").filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(`src/${file}`, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) if (!zh[m[1]]) missing.push(m[1]);
  }
  assert.deepEqual(missing, []);
});
