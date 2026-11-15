/**
 * Pawpal's rules: the pet, its needs, how care changes them, how it grows and
 * what its mood is. No three.js and no DOM here, so the tests run it in Node.
 *
 * Times are milliseconds since 1970 (Date.now()). A "day" is the player's
 * local calendar day, written "YYYY-MM-DD".
 */

export type Species = "puppy" | "kitten" | "fox" | "dragon";
export type Need = "food" | "fun" | "clean" | "love";
export type Stage = "egg" | "baby" | "kid" | "grown";
export type Mood = "joyful" | "happy" | "okay" | "sad";
export type Care = "feed" | "treat" | "play" | "bathe" | "pet";

export const NEEDS: Need[] = ["food", "fun", "clean", "love"];

/** Every species. Puppy and kitten are free; fox and dragon are in the shop. */
export const SPECIES: { id: Species; shop?: string }[] = [
  { id: "puppy" },
  { id: "kitten" },
  { id: "fox", shop: "pet-fox" },
  { id: "dragon", shop: "pet-dragon" },
];

export type Pet = {
  species: Species;
  name: string;
  /** When the egg was chosen. */
  born: number;
  /** Taps on the egg so far; it hatches at HATCH_TAPS. */
  taps: number;
  hatched: boolean;
  needs: Record<Need, number>;
  /** When `needs` were last brought up to date. */
  at: number;
  /** Days on which the player cared for the pet at least once. */
  careDays: number;
  /** The last day the player cared for the pet. */
  lastCare: string;
  /** Days in a row with care, ending on lastCare. */
  streak: number;
  bestStreak: number;
  /** Treats won in mini-games, given with the Treat button. */
  treats: number;
  /** The outfit the pet wears (a shop id), or "" for none. */
  outfit: string;
  /** Decorations placed in the room (shop ids). */
  decor: string[];
  /** The wallpaper (a shop id), or "" for the plain one. */
  wallpaper: string;
};

export const HATCH_TAPS = 5;
/** Care days it takes to grow into a kid, then into a grown-up. */
export const KID_DAYS = 3;
export const GROWN_DAYS = 7;
export const MAX_NAME = 16;

/** How many points each need loses per hour away. */
export const DECAY_PER_HOUR: Record<Need, number> = {
  food: 6,
  fun: 5,
  clean: 3,
  love: 2,
};
/**
 * Needs never drop below this from time away: a pet left alone misses the
 * player and looks sad, but it never gets sick or runs away.
 */
export const FLOOR = 10;

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function cleanName(name: string): string {
  return Array.from(name.replace(/\s+/g, " ").trim())
    .slice(0, MAX_NAME)
    .join("");
}

export function newPet(species: Species, name: string, now: number): Pet {
  return {
    species,
    name: cleanName(name),
    born: now,
    taps: 0,
    hatched: false,
    needs: { food: 80, fun: 80, clean: 90, love: 60 },
    at: now,
    careDays: 0,
    lastCare: "",
    streak: 0,
    bestStreak: 0,
    treats: 3,
    outfit: "",
    decor: [],
    wallpaper: "",
  };
}

export function dayKey(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function previousDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12).getTime());
}

/** Helpers bought in the shop that change the rules (see pet-shop.ts). */
export type Perks = {
  /** Treat jar tier, 0-3: free treats on the first care of each day. */
  jar: number;
  /** Cozy feeder: food and cleanliness drop a quarter slower. */
  feeder: boolean;
  /** Play mat: one more treat from every mini-game round. */
  mat: boolean;
  /** Growth snack: each day of care counts twice towards growing up. */
  vitamins: boolean;
};
export const NO_PERKS: Perks = {
  jar: 0,
  feeder: false,
  mat: false,
  vitamins: false,
};

/** Lowers the needs for the time passed since `pet.at`. */
export function tick(pet: Pet, now: number, perks: Perks = NO_PERKS): Pet {
  if (!pet.hatched || now <= pet.at) return { ...pet, at: Math.max(pet.at, now) };
  const hours = (now - pet.at) / 3_600_000;
  const needs = { ...pet.needs };
  for (const need of NEEDS) {
    const before = needs[need];
    if (before <= FLOOR) continue;
    const slow = perks.feeder && (need === "food" || need === "clean");
    const rate = DECAY_PER_HOUR[need] * (slow ? 0.75 : 1);
    needs[need] = Math.max(FLOOR, before - rate * hours);
  }
  return { ...pet, needs, at: now };
}

/** One tap on the egg. Returns the pet, hatched on the last tap. */
export function tapEgg(pet: Pet, now: number): Pet {
  if (pet.hatched) return pet;
  const taps = pet.taps + 1;
  if (taps < HATCH_TAPS) return { ...pet, taps };
  return { ...pet, taps, hatched: true, at: now };
}

export function stage(pet: Pet): Stage {
  if (!pet.hatched) return "egg";
  if (pet.careDays < KID_DAYS) return "baby";
  if (pet.careDays < GROWN_DAYS) return "kid";
  return "grown";
}

/** Care days left before the next stage, or 0 when grown. */
export function daysToGrow(pet: Pet): number {
  if (pet.careDays < KID_DAYS) return KID_DAYS - pet.careDays;
  if (pet.careDays < GROWN_DAYS) return GROWN_DAYS - pet.careDays;
  return 0;
}

export function mood(pet: Pet): Mood {
  const avg = NEEDS.reduce((s, n) => s + pet.needs[n], 0) / NEEDS.length;
  const low = Math.min(...NEEDS.map((n) => pet.needs[n]));
  if (avg >= 80 && low >= 60) return "joyful";
  if (avg >= 60 && low >= 30) return "happy";
  if (avg >= 40) return "okay";
  return "sad";
}

/** The need the pet asks for, if any is low. */
export function wish(pet: Pet): Need | null {
  let best: Need | null = null;
  for (const need of NEEDS)
    if (pet.needs[need] < 50 && (!best || pet.needs[need] < pet.needs[best]))
      best = need;
  return best;
}

/** What each kind of care does to the needs. Basic care is always free. */
export const CARE: Record<Care, Partial<Record<Need, number>>> = {
  feed: { food: 30, love: 2 },
  treat: { food: 15, fun: 15, love: 8 },
  play: { fun: 25, food: -4, clean: -5, love: 3 },
  bathe: { clean: 45, love: 2 },
  pet: { love: 10, fun: 2 },
};

export type CareResult = {
  pet: Pet;
  /** False when the pet didn't want it (full, already clean, no treats). */
  done: boolean;
  /** True on the first care of a new day: a care day was counted. */
  newDay: boolean;
  /** The stage the pet grew into with this care, if it grew. */
  grew: Stage | null;
};

/** Whether the pet wants this care right now. */
export function wants(pet: Pet, care: Care): boolean {
  if (!pet.hatched) return false;
  if (care === "feed") return pet.needs.food < 95;
  if (care === "bathe") return pet.needs.clean < 95;
  if (care === "treat") return pet.treats > 0;
  return true;
}

export function care(
  before: Pet,
  kind: Care,
  now: number,
  perks: Perks = NO_PERKS,
): CareResult {
  let pet = tick(before, now, perks);
  if (!wants(pet, kind)) return { pet, done: false, newDay: false, grew: null };
  const needs = { ...pet.needs };
  for (const [need, change] of Object.entries(CARE[kind]))
    needs[need as Need] = clamp(needs[need as Need] + (change ?? 0));
  pet = { ...pet, needs };
  if (kind === "treat") pet.treats -= 1;
  const today = dayKey(now);
  let newDay = false;
  let grew: Stage | null = null;
  if (pet.lastCare !== today) {
    newDay = true;
    const was = stage(pet);
    const streak = pet.lastCare === previousDay(today) ? pet.streak + 1 : 1;
    pet = {
      ...pet,
      careDays: pet.careDays + (perks.vitamins ? 2 : 1),
      treats: Math.min(99, pet.treats + perks.jar),
      lastCare: today,
      streak,
      bestStreak: Math.max(pet.bestStreak, streak),
    };
    const now2 = stage(pet);
    if (now2 !== was) grew = now2;
  }
  return { pet, done: true, newDay, grew };
}

/**
 * dingn coins for the first care of a day: 5, plus 1 for each day of the
 * streak after the first, up to 10 (the most one rewards.earn call pays).
 */
export function dailyCoins(streak: number): number {
  return Math.min(10, 5 + Math.max(0, streak - 1));
}

/** Whether the player has been away long enough for a "welcome back". */
export function missedYou(pet: Pet, now: number): boolean {
  return pet.hatched && now - pet.at > 2 * 3_600_000;
}

// ---------------------------------------------------------------------------
// Mini-games: what a round pays. Treats are free and only won by playing;
// coins come from dingn's rewards.earn for signed-in players.

export type Game = "catch" | "seek" | "dance";

export function roundPrize(
  game: Game,
  score: number,
): { treats: number; coins: number; fun: number } {
  if (score <= 0) return { treats: 0, coins: 0, fun: 10 };
  const per = game === "catch" ? 6 : 2;
  return {
    treats: Math.min(5, Math.max(1, Math.floor(score / per))),
    coins: Math.min(10, Math.max(1, Math.ceil(score / (per / 2)))),
    fun: Math.min(40, 15 + score * 2),
  };
}

/** Applies a finished mini-game round to the pet. */
export function finishRound(
  before: Pet,
  game: Game,
  score: number,
  now: number,
  perks: Perks = NO_PERKS,
) {
  const base = roundPrize(game, score);
  const prize = { ...base, treats: base.treats + (perks.mat && score > 0 ? 1 : 0) };
  const result = care(before, "pet", now, perks);
  const pet = {
    ...result.pet,
    treats: Math.min(99, result.pet.treats + prize.treats),
    needs: {
      ...result.pet.needs,
      fun: clamp(result.pet.needs.fun + prize.fun),
      // Playing works up an appetite and gets the pet a little messy.
      food: clamp(result.pet.needs.food - 3),
      clean: clamp(result.pet.needs.clean - 4),
    },
  };
  return { ...result, pet, prize };
}

// ---------------------------------------------------------------------------
// Saving: a record that can be read back safely, whatever was stored.

const isSpecies = (v: unknown): v is Species =>
  SPECIES.some((s) => s.id === v);

/** Reads a saved pet, or null when there is none or it is unreadable. */
export function readPet(data: unknown): Pet | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (!isSpecies(d.species) || typeof d.name !== "string") return null;
  const num = (v: unknown, fallback: number, lo = 0, hi = Infinity) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(lo, Math.min(hi, v))
      : fallback;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const needsIn = (d.needs ?? {}) as Record<string, unknown>;
  const needs = Object.fromEntries(
    NEEDS.map((n) => [n, num(needsIn[n], 60, 0, 100)]),
  ) as Record<Need, number>;
  return {
    species: d.species,
    name: cleanName(d.name) || "Pal",
    born: num(d.born, 0),
    taps: num(d.taps, 0, 0, HATCH_TAPS),
    hatched: d.hatched === true,
    needs,
    at: num(d.at, 0),
    careDays: Math.floor(num(d.careDays, 0)),
    lastCare: str(d.lastCare),
    streak: Math.floor(num(d.streak, 0)),
    bestStreak: Math.floor(num(d.bestStreak, 0)),
    treats: Math.floor(num(d.treats, 0, 0, 99)),
    outfit: str(d.outfit),
    decor: Array.isArray(d.decor)
      ? d.decor.filter((x): x is string => typeof x === "string").slice(0, 20)
      : [],
    wallpaper: str(d.wallpaper),
  };
}

/** Of two saved pets (device and account), the one changed last. */
export function newer(a: Pet | null, b: Pet | null): Pet | null {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

// ---------------------------------------------------------------------------
// Badges (listed in game.json).

/** Badges the pet's state has earned. */
export function petBadges(pet: Pet): string[] {
  const out: string[] = [];
  if (pet.hatched) out.push("hatched");
  const s = stage(pet);
  if (s === "kid" || s === "grown") out.push("kid");
  if (s === "grown") out.push("grown");
  for (const n of [3, 7, 30]) if (pet.bestStreak >= n) out.push(`streak-${n}`);
  if (pet.hatched && mood(pet) === "joyful") out.push("joyful");
  if (pet.outfit) out.push("dress-up");
  if (pet.decor.length >= 3) out.push("decorator");
  return out;
}

/** Badges a mini-game score has earned. */
export function roundBadges(game: Game, score: number): string[] {
  const goals: Record<Game, [number, string][]> = {
    catch: [
      [20, "catch-20"],
      [40, "catch-40"],
    ],
    seek: [
      [5, "seek-5"],
      [10, "seek-10"],
    ],
    dance: [
      [6, "dance-6"],
      [10, "dance-10"],
    ],
  };
  return goals[game].filter(([n]) => score >= n).map(([, id]) => id);
}

// ---------------------------------------------------------------------------
// A player can raise one pet of each species they have an egg for.

export type Home = { pets: Pet[]; active: number };

export function readHome(data: unknown): Home | null {
  const d = data as { pets?: unknown; active?: unknown } | null;
  if (d && Array.isArray(d.pets)) {
    const pets: Pet[] = [];
    for (const p of d.pets) {
      const pet = readPet(p);
      if (pet && !pets.some((q) => q.species === pet.species)) pets.push(pet);
    }
    if (!pets.length) return null;
    const active = typeof d.active === "number" ? Math.floor(d.active) : 0;
    return { pets, active: active >= 0 && active < pets.length ? active : 0 };
  }
  // An older save with a single pet.
  const pet = readPet(data);
  return pet ? { pets: [pet], active: 0 } : null;
}

const lastChange = (h: Home) => Math.max(...h.pets.map((p) => p.at));

/** Of two saved homes (device and account), the one changed last. */
export function newerHome(a: Home | null, b: Home | null): Home | null {
  if (!a) return b;
  if (!b) return a;
  return lastChange(b) > lastChange(a) ? b : a;
}
