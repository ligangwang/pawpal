import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DingnGame, Locale } from "../sdk/dingn-sdk.js";
import { PawpalGame } from "../src/pet-game";
import { DingnProvider } from "../src/dingn";
import manifest from "../game.json";

const mocks = vi.hoisted(() => ({ acts: [] as string[], scene: null as null | { onTap: (w: string) => void } }));
// A stand-in for the three.js scene (jsdom has no WebGL).
vi.mock("../src/pet-scene", () => ({
  PetScene: class {
    onTap = (_: string) => {};
    constructor() {
      mocks.scene = this;
    }
    resize() {}
    setPet() {}
    setEggTaps() {}
    setMood() {}
    setRoom() {}
    act(kind: string) {
      mocks.acts.push(kind);
    }
    headOnScreen = () => ({ x: 100, y: 100 });
    dispose() {}
  },
}));

let stored: Map<string, unknown>;
let owned: Set<string>;
const calls = {
  save: vi.fn(),
  spend: vi.fn(),
  earn: vi.fn(),
  unlock: vi.fn(),
  signIn: vi.fn(),
};
function fakeSdk(signedIn: boolean, locale: Locale = "en"): DingnGame {
  return {
    gameId: "pawpal",
    version: "1.0.0",
    locale,
    player: { signedIn, name: signedIn ? "Ada" : "", avatar: "" },
    embedded: true,
    onPlayer: () => () => {},
    storage: {
      get: async (k) => (stored.get(k) as never) ?? null,
      set: async (k, v) => void stored.set(k, v),
    },
    progress: { load: async () => null, save: calls.save },
    rewards: {
      unlock: calls.unlock,
      list: async () => [],
      spend: calls.spend,
      shop: async () =>
        manifest.shop.map((i) => ({ id: i.id, price: i.price, title: i.title.en, owned: owned.has(i.id) })),
      earn: calls.earn,
    },
    requestSignIn: calls.signIn,
    navigate() {},
    ready() {},
  };
}
const play = (sdk: DingnGame) =>
  render(
    <DingnProvider sdk={sdk}>
      <PawpalGame />
    </DingnProvider>,
  );
const savedPet = (extra: object = {}) => ({
  pets: [
    {
      species: "puppy",
      name: "Biscuit",
      born: Date.now(),
      taps: 5,
      hatched: true,
      needs: { food: 50, fun: 60, clean: 70, love: 60 },
      at: Date.now(),
      careDays: 1,
      lastCare: "",
      streak: 0,
      bestStreak: 0,
      treats: 2,
      outfit: "",
      decor: [],
      wallpaper: "",
      ...extra,
    },
  ],
  active: 0,
});

beforeEach(() => {
  stored = new Map();
  owned = new Set();
  mocks.acts = [];
  calls.save.mockReset().mockResolvedValue(undefined);
  calls.spend.mockReset().mockImplementation(async (id: string) => {
    owned.add(id);
    return { new: true, coins: 40 };
  });
  calls.earn.mockReset().mockImplementation(async (coins: number) => ({ coins, left: 100 }));
  calls.unlock.mockReset().mockResolvedValue({ new: true, coins: 10 });
  calls.signIn.mockReset();
});
afterEach(cleanup);

test("a new player picks a pet, names it and hatches the egg", async () => {
  play(fakeSdk(false));
  expect(await screen.findByRole("heading", { name: "Choose your pet" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Fox/ }).textContent).toContain("200 coins");
  fireEvent.click(screen.getByRole("radio", { name: /Kitten/ }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mochi" } });
  fireEvent.click(screen.getByRole("button", { name: "Choose this egg" }));
  expect(await screen.findByRole("heading", { name: "Mochi" })).toBeTruthy();
  for (let i = 0; i < 5; i++) act(() => mocks.scene!.onTap("egg"));
  expect(mocks.acts).toContain("hatch");
  expect(await screen.findByRole("button", { name: "Feed" })).toBeTruthy();
  expect((stored.get("home") as { pets: { hatched: boolean }[] }).pets[0].hatched).toBe(true);
});

test("the first care of the day pays daily coins to a signed-in player", async () => {
  stored.set("home", savedPet());
  play(fakeSdk(true));
  fireEvent.click(await screen.findByRole("button", { name: "Feed" }));
  expect(mocks.acts).toContain("feed");
  await waitFor(() => expect(calls.earn).toHaveBeenCalledWith(5));
  expect(await screen.findByText("Daily visit: +5 coins")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Pet" }));
  expect(calls.earn).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(calls.save).toHaveBeenCalled());
});

test("signed-out players are asked to sign in instead of earning", async () => {
  stored.set("home", savedPet());
  play(fakeSdk(false));
  fireEvent.click(await screen.findByRole("button", { name: "Play" }));
  expect(calls.earn).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("button", { name: "Sign in" })[0]);
  expect(calls.signIn).toHaveBeenCalled();
});

test("try on an outfit, then buy and wear it", async () => {
  stored.set("home", savedPet());
  play(fakeSdk(true));
  fireEvent.click(await screen.findByRole("button", { name: "Shop" }));
  const crown = screen.getByText("Golden crown").closest("li")!;
  fireEvent.click(crown.querySelector("button")!);
  expect(crown.className).toContain("trying");
  fireEvent.click(screen.getByRole("button", { name: "400 coins" }));
  await waitFor(() => expect(calls.spend).toHaveBeenCalledWith("outfit-crown"));
  expect(await screen.findByRole("button", { name: "Take off" })).toBeTruthy();
  await waitFor(() =>
    expect((stored.get("home") as { pets: { outfit: string }[] }).pets[0].outfit).toBe("outfit-crown"),
  );
  await waitFor(() => expect(calls.unlock).toHaveBeenCalledWith("dress-up"));
});

test("tiered helpers need the tier before", async () => {
  stored.set("home", savedPet());
  play(fakeSdk(true));
  fireEvent.click(await screen.findByRole("button", { name: "Shop" }));
  fireEvent.click(screen.getByRole("tab", { name: "Helpers" }));
  expect(screen.getAllByRole("button", { name: "Needs the one before" }).length).toBe(2);
});

test("a pet's egg from the shop hatches a second pet", async () => {
  stored.set("home", savedPet());
  owned.add("pet-dragon");
  play(fakeSdk(true));
  fireEvent.click(await screen.findByRole("button", { name: "Shop" }));
  fireEvent.click(screen.getByRole("tab", { name: "New pets" }));
  fireEvent.click(await screen.findByRole("button", { name: "Hatch" }));
  fireEvent.click(await screen.findByRole("button", { name: "Choose this egg" }));
  await waitFor(() => expect((stored.get("home") as { pets: unknown[] }).pets.length).toBe(2));
  expect(screen.getByRole("group", { name: "Your pets" })).toBeTruthy();
});

test("speaks Chinese", async () => {
  stored.set("home", savedPet());
  play(fakeSdk(false, "zh-CN"));
  expect(await screen.findByRole("button", { name: "喂食" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "商店" }));
  expect(screen.getByText("金色王冠")).toBeTruthy();
});
