/**
 * Saving the pet and paying rewards through the dingn SDK. The pet is kept on
 * the device (dingn.storage) and, for a signed-in player, on their account
 * (dingn.progress), so it follows them to another device. Badges a signed-out
 * player earns are remembered and sent once they sign in.
 */
import type { DingnGame } from "../sdk/dingn-sdk.js";
import { newerHome, readHome, type Home } from "./pet-core";

const PET_KEY = "home";
const BADGE_KEY = "badges";
const SOUND_KEY = "sound";

export async function loadHome(sdk: DingnGame): Promise<Home | null> {
  const device = await sdk.storage.get(PET_KEY).catch(() => null);
  let account: unknown = null;
  if (sdk.player.signedIn) {
    const data = (await sdk.progress.load().catch(() => null)) as {
      home?: unknown;
    } | null;
    account = data?.home ?? null;
  }
  return newerHome(readHome(device), readHome(account));
}

export async function saveHome(sdk: DingnGame, home: Home) {
  const json = JSON.parse(JSON.stringify(home));
  await sdk.storage.set(PET_KEY, json).catch(() => {});
  if (sdk.player.signedIn) await sdk.progress.save({ home: json }).catch(() => {});
}

export async function loadSound(sdk: DingnGame) {
  return (await sdk.storage.get(SOUND_KEY).catch(() => null)) !== false;
}
export function saveSound(sdk: DingnGame, on: boolean) {
  void sdk.storage.set(SOUND_KEY, on).catch(() => {});
}

/** Badges earned on this device, sent to dingn or waiting for a sign-in. */
export class Badges {
  private earned = new Set<string>();
  private sent = new Set<string>();
  constructor(private sdk: DingnGame) {}
  async load() {
    const data = (await this.sdk.storage.get(BADGE_KEY).catch(() => null)) as {
      earned?: string[];
      sent?: string[];
    } | null;
    for (const id of data?.earned ?? []) this.earned.add(id);
    for (const id of data?.sent ?? []) this.sent.add(id);
  }
  private store() {
    void this.sdk.storage
      .set(BADGE_KEY, { earned: [...this.earned], sent: [...this.sent] })
      .catch(() => {});
  }
  /** Marks badges as earned and sends any that dingn hasn't had yet. */
  async earn(ids: string[]) {
    let changed = false;
    for (const id of ids)
      if (!this.earned.has(id)) {
        this.earned.add(id);
        changed = true;
      }
    if (changed) this.store();
    await this.flush();
  }
  /** Sends earned badges once the player is signed in. */
  async flush() {
    if (!this.sdk.player.signedIn) return;
    for (const id of this.earned) {
      if (this.sent.has(id)) continue;
      try {
        const result = await this.sdk.rewards.unlock(id);
        if (!result.test) this.sent.add(id);
      } catch {
        return;
      }
    }
    this.store();
  }
}

/** Pays dingn coins for play. Returns the coins paid (0 when signed out or done for today). */
export async function earnCoins(sdk: DingnGame, coins: number): Promise<number> {
  if (!sdk.player.signedIn || coins <= 0) return 0;
  try {
    const result = await sdk.rewards.earn(Math.min(10, Math.max(1, Math.round(coins))));
    return result.coins;
  } catch {
    return 0;
  }
}
