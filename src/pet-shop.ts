/**
 * The shop: everything in game.json's `shop`, sorted into shelves by the
 * start of its id, and the helpers that owned items switch on. Every item is
 * bought once with dingn coins and kept. Nothing is random, and basic care
 * never costs anything.
 */
import manifest from "../game.json";
import type { DingnGame } from "../sdk/dingn-sdk.js";
import type { Perks, Species } from "./pet-core";

export type Shelf = "pets" | "outfits" | "decor" | "walls" | "helpers";
export type ShopEntry = {
  id: string;
  price: number;
  requires?: string;
  title: { en: string; zh: string };
  shelf: Shelf;
};

export function shelfOf(id: string): Shelf {
  if (id.startsWith("pet-")) return "pets";
  if (id.startsWith("outfit-")) return "outfits";
  if (id.startsWith("decor-")) return "decor";
  if (id.startsWith("wall-")) return "walls";
  return "helpers";
}

export const CATALOG: ShopEntry[] = manifest.shop.map((item) => ({
  ...item,
  shelf: shelfOf(item.id),
}));
export const SHELVES: Shelf[] = ["outfits", "decor", "walls", "helpers", "pets"];

export const priceOf = (id: string) =>
  CATALOG.find((item) => item.id === id)?.price ?? 0;

/** The species a shop id unlocks, if it is a pet egg. */
export const speciesOf = (id: string) =>
  id.startsWith("pet-") ? (id.slice(4) as Species) : null;

export function perksFrom(owned: ReadonlySet<string>): Perks {
  return {
    jar: owned.has("jar-3") ? 3 : owned.has("jar-2") ? 2 : owned.has("jar-1") ? 1 : 0,
    feeder: owned.has("feeder"),
    mat: owned.has("mat"),
    vitamins: owned.has("vitamins"),
  };
}

/** What the signed-in player owns, or an empty set. */
export async function loadOwned(sdk: DingnGame): Promise<Set<string>> {
  if (!sdk.player.signedIn) return new Set();
  try {
    const items = await sdk.rewards.shop();
    return new Set(items.filter((i) => i.owned).map((i) => i.id));
  } catch {
    return new Set();
  }
}

export type BuyResult = "bought" | "cancelled" | "poor" | "locked" | "signin" | "failed";

/** Buys an item. dingn asks the player to confirm before any coins move. */
export async function buy(sdk: DingnGame, id: string): Promise<BuyResult> {
  if (!sdk.player.signedIn) return "signin";
  try {
    await sdk.rewards.spend(id);
    return "bought";
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "cancelled") return "cancelled";
    if (code === "not_enough_coins") return "poor";
    if (code === "requires") return "locked";
    if (code === "signed_out") return "signin";
    return "failed";
  }
}
