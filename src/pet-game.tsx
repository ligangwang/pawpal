/**
 * Pawpal: the screens around the 3D room. Adopting and hatching a pet, daily
 * care, the mini-games and the shop.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  care,
  dailyCoins,
  daysToGrow,
  finishRound,
  mood,
  missedYou,
  NEEDS,
  newPet,
  petBadges,
  roundBadges,
  SPECIES,
  stage,
  tapEgg,
  tick,
  wish,
  MAX_NAME,
  type Care,
  type Game,
  type Home,
  type Need,
  type Pet,
  type Species,
} from "./pet-core";
import {
  buy,
  CATALOG,
  loadOwned,
  perksFrom,
  SHELVES,
  speciesOf,
  type Shelf,
  type ShopEntry,
} from "./pet-shop";
import { Badges, earnCoins, loadHome, loadSound, saveHome, saveSound } from "./pet-save";
import { PetScene, type DanceMove } from "./pet-scene";
import { PetFace } from "./pet-face";
import { DanceAlong, HideAndSeek, TreatCatch } from "./minigames";
import { Sound } from "./pet-sound";
import { useDingn, useLocale, type Translate } from "./dingn";

const NAMES: Record<Species, string[]> = {
  puppy: ["Biscuit", "Waffles", "Pudding", "Buddy", "Maple"],
  kitten: ["Mochi", "Pepper", "Luna", "Noodle", "Misty"],
  fox: ["Ember", "Rusty", "Clementine", "Sunny", "Pip"],
  dragon: ["Sprout", "Pickle", "Jade", "Puff", "Kiwi"],
};
const SPECIES_NAME: Record<Species, string> = {
  puppy: "Puppy",
  kitten: "Kitten",
  fox: "Fox",
  dragon: "Dragon",
};
const NEED_NAME: Record<Need, string> = { food: "Food", fun: "Fun", clean: "Clean", love: "Love" };
const WISH: Record<Need, string> = {
  food: "I'm hungry!",
  fun: "Let's play!",
  clean: "I need a bath!",
  love: "Pet me, please?",
};
const SHELF_NAME: Record<Shelf, string> = {
  outfits: "Outfits",
  decor: "Room",
  walls: "Wallpaper",
  helpers: "Helpers",
  pets: "New pets",
};

/**
 * Speech and toasts are kept as how to word them, not as words, so they show
 * in the new language if the player switches while one is on screen.
 */
type Words = (t: Translate) => string;
type Toast = { id: number; text: Words; kind: "coin" | "info" };

export function PawpalGame() {
  const sdk = useDingn();
  const { t } = useLocale();
  const [home, setHome] = useState<Home | null | undefined>(undefined);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [adopting, setAdopting] = useState<Species | null>(null);
  const [panel, setPanel] = useState<"games" | "shop" | null>(null);
  const [shelf, setShelf] = useState<Shelf>("outfits");
  const [game, setGame] = useState<Game | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [bubble, setBubble] = useState<{ text: Words; at: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [noWebgl, setNoWebgl] = useState(false);
  const [, setNow] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PetScene | null>(null);
  const homeRef = useRef<Home | null | undefined>(undefined);
  homeRef.current = home;
  const sound = useMemo(() => new Sound(), []);
  const badges = useMemo(() => new Badges(sdk), [sdk]);
  const perks = perksFrom(owned);
  const perksRef = useRef(perks);
  perksRef.current = perks;
  const signedIn = sdk.player.signedIn;

  const pet = home ? home.pets[home.active] : null;

  const say = useCallback((text: Words) => setBubble({ text, at: Date.now() }), []);
  const toast = useCallback((text: Words, kind: Toast["kind"] = "info") => {
    const id = Math.random();
    setToasts((list) => [...list.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3500);
  }, []);
  useEffect(() => {
    if (!bubble) return;
    const timer = setTimeout(() => setBubble(null), 3200);
    return () => clearTimeout(timer);
  }, [bubble]);

  /** Replaces the active pet, saves, and awards any badges it now has. */
  const putPet = useCallback(
    (next: Pet) => {
      const h = homeRef.current;
      const pets = h ? h.pets.map((p, i) => (i === h.active ? next : p)) : [next];
      const nextHome = { pets, active: h?.active ?? 0 };
      homeRef.current = nextHome;
      setHome(nextHome);
      void saveHome(sdk, nextHome);
      void badges.earn(petBadges(next));
    },
    [sdk, badges],
  );

  // Load the saved pets, what the player owns and their sound setting.
  useEffect(() => {
    let live = true;
    void (async () => {
      const [saved, own, snd] = await Promise.all([
        loadHome(sdk).catch(() => null),
        loadOwned(sdk),
        loadSound(sdk),
        badges.load(),
      ]);
      if (!live) return;
      setOwned(own);
      setSoundOn(snd);
      sound.on = snd;
      if (!saved) {
        setHome(null);
        return;
      }
      const now = Date.now();
      const active = saved.pets[saved.active];
      const away = missedYou(active, now);
      const pets = saved.pets.map((p) => tick(p, now, perksFrom(own)));
      setHome({ pets, active: saved.active });
      if (away) {
        setTimeout(() => {
          sceneRef.current?.act("wave");
          say((t) => t("I missed you! Welcome back!"));
        }, 600);
      } else if (active.hatched) setTimeout(() => say((t) => t("Hi again!")), 600);
    })();
    return () => {
      live = false;
    };
    // Load once; signing in is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signing in: fetch what they own, send waiting badges, sync the pets.
  const firstPlayer = useRef(true);
  useEffect(() => {
    if (firstPlayer.current) {
      firstPlayer.current = false;
      return;
    }
    void (async () => {
      setOwned(await loadOwned(sdk));
      if (!signedIn) return;
      await badges.flush();
      const merged = await loadHome(sdk).catch(() => null);
      const h = homeRef.current;
      const best = merged && h ? (Math.max(...merged.pets.map((p) => p.at)) > Math.max(...h.pets.map((p) => p.at)) ? merged : h) : merged ?? h;
      if (best) {
        setHome(best);
        void saveHome(sdk, best);
      }
    })();
  }, [signedIn, sdk, badges]);

  // Needs drop slowly while the game is open.
  useEffect(() => {
    const timer = setInterval(() => {
      const h = homeRef.current;
      if (!h) return;
      const now = Date.now();
      setHome({ ...h, pets: h.pets.map((p) => tick(p, now, perksRef.current)) });
      setNow(now);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // The 3D scene.
  const hasPet = !!pet;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasPet) return;
    let scene: PetScene;
    try {
      scene = new PetScene(canvas);
    } catch {
      setNoWebgl(true);
      return;
    }
    sceneRef.current = scene;
    const fit = () => scene.resize(canvas.clientWidth || 800, canvas.clientHeight || 600);
    fit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(canvas);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [hasPet]);

  const tapRef = useRef<(what: "pet" | "egg") => void>(() => {});
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.onTap = (what) => tapRef.current(what);
  });

  // Show the pet and room in the scene, with anything being tried on.
  const previewShelf = preview ? CATALOG.find((i) => i.id === preview)?.shelf : null;
  const outfit = previewShelf === "outfits" ? preview! : pet?.outfit ?? "";
  const decor = pet
    ? previewShelf === "decor" && !pet.decor.includes(preview!)
      ? [...pet.decor, preview!]
      : pet.decor
    : [];
  const wallpaper = previewShelf === "walls" ? preview! : pet?.wallpaper ?? "";
  const petStage = pet ? stage(pet) : "egg";
  const petMood = pet ? mood(pet) : "happy";
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !pet) return;
    scene.setPet({ species: pet.species, stage: petStage, outfit });
    scene.setEggTaps(pet.taps);
    scene.setMood(petMood);
    scene.setRoom({ decor, wallpaper });
  });

  const act = (kind: Parameters<PetScene["act"]>[0]) => sceneRef.current?.act(kind);

  const doCare = (kind: Care) => {
    if (!pet) return;
    const now = Date.now();
    const result = care(pet, kind, now, perks);
    if (!result.done) {
      sound.play("miss");
      say((t) =>
        t(
          kind === "feed"
            ? "I'm full, thank you!"
            : kind === "bathe"
              ? "I'm already squeaky clean!"
              : "No treats yet. Win some in a mini-game!",
        ),
      );
      putPet(result.pet);
      return;
    }
    act(kind);
    sound.play(kind === "feed" ? "feed" : kind === "bathe" ? "bathe" : kind === "play" ? "play" : "happy");
    const lines: Record<Care, string[]> = {
      feed: ["Yum, yum!", "Delicious!", "Thank you!"],
      treat: ["My favorite!", "Wow, a treat!"],
      play: ["Again, again!", "That was fun!", "Wheee!"],
      bathe: ["Splish splash!", "So fresh!", "Bubbles!"],
      pet: ["I love you!", "That feels nice!", "Hehe!"],
    };
    const line = lines[kind][Math.floor(Math.random() * lines[kind].length)];
    say((t) => t(line));
    putPet(result.pet);
    afterCare(result.pet, result.newDay, result.grew);
  };

  const afterCare = (next: Pet, newDay: boolean, grew: string | null) => {
    if (grew) {
      setTimeout(() => {
        act("grow");
        sound.play("hatch");
        say((t) => t(grew === "kid" ? "Look, I grew into a kid!" : "I'm all grown up now!"));
      }, 1600);
    }
    if (!newDay) return;
    if (perks.jar) toast((t) => t("Your treat jar gave {0} free treats", perks.jar));
    if (!signedIn) return;
    void earnCoins(sdk, dailyCoins(next.streak)).then((coins) => {
      if (!coins) return;
      sound.play("coin");
      toast(
        (t) =>
          next.streak > 1
            ? t("Daily visit: +{0} coins ({1}-day streak)", coins, next.streak)
            : t("Daily visit: +{0} coins", coins),
        "coin",
      );
    });
  };

  tapRef.current = (what) => {
    if (!pet || game) return;
    if (what === "egg") {
      const next = tapEgg(pet, Date.now());
      if (next.hatched) {
        act("hatch");
        sound.play("hatch");
        setTimeout(() => say((t) => t("Hi! I'm {0}!", next.name)), 500);
      } else {
        act("egg");
        sound.play("tap");
        say((t) => t(["Wiggle!", "Crack!", "Almost…", "Here I come!"][Math.min(3, next.taps - 1)]));
      }
      putPet(next);
    } else doCare("pet");
  };

  const endGame = (kind: Game, score: number) => {
    setGame(null);
    if (!pet) return;
    const now = Date.now();
    const result = finishRound(pet, kind, score, now, perks);
    putPet(result.pet);
    act("wave");
    sound.play("happy");
    say((t) => (score > 0 ? t("That was the best! Thank you!") : t("Thanks for playing with me!")));
    if (result.prize.treats) toast((t) => t("+{0} treats", result.prize.treats));
    void badges.earn(roundBadges(kind, score));
    afterCare(result.pet, result.newDay, result.grew);
    if (result.prize.coins && signedIn)
      void earnCoins(sdk, result.prize.coins).then((coins) => {
        if (coins) {
          sound.play("coin");
          toast((t) => t("+{0} coins", coins), "coin");
        } else toast((t) => t("That's all the coins for today. Treats are still yours!"));
      });
  };
  const onDanceMove = useCallback(
    (move: DanceMove) => {
      sceneRef.current?.act(move);
      sound.play("step");
    },
    [sound],
  );

  // ---- Adopting -----------------------------------------------------------

  const adopt = (species: Species, name: string) => {
    const created = newPet(species, name || t(NAMES[species][0]), Date.now());
    const h = homeRef.current;
    const pets = h ? [...h.pets, created] : [created];
    const next = { pets, active: pets.length - 1 };
    homeRef.current = next;
    setHome(next);
    void saveHome(sdk, next);
    setAdopting(null);
    setTimeout(() => say((t) => t("Tap the egg to help it hatch!")), 400);
  };

  const switchTo = (index: number) => {
    const h = homeRef.current;
    if (!h || index === h.active) return;
    const next = { ...h, active: index };
    setHome(next);
    void saveHome(sdk, next);
    setTimeout(() => say((t) => t("Hi, it's me, {0}!", h.pets[index].name)), 300);
  };

  // ---- The shop -----------------------------------------------------------

  const buyItem = async (item: ShopEntry) => {
    const result = await buy(sdk, item.id);
    if (result === "signin") return sdk.requestSignIn();
    if (result === "cancelled") return;
    if (result === "poor")
      return toast((t) => t("Not enough coins yet. Visit every day and play mini-games to earn more!"));
    if (result === "locked") return toast((t) => t("Get the one before it first."));
    if (result === "failed") return toast((t) => t("Something went wrong. Please try again."));
    setOwned((set) => new Set(set).add(item.id));
    setPreview(null);
    sound.play("coin");
    act("buy");
    say((t) => t("Thank you! I love it!"));
    if (pet) {
      if (item.shelf === "outfits") putPet({ ...pet, outfit: item.id });
      if (item.shelf === "decor") putPet({ ...pet, decor: [...pet.decor, item.id] });
      if (item.shelf === "walls") putPet({ ...pet, wallpaper: item.id });
    }
    if (item.shelf === "pets") {
      setPanel(null);
      setAdopting(speciesOf(item.id));
    }
  };

  const useItem = (item: ShopEntry) => {
    if (!pet) return;
    setPreview(null);
    if (item.shelf === "outfits") putPet({ ...pet, outfit: pet.outfit === item.id ? "" : item.id });
    if (item.shelf === "decor")
      putPet({
        ...pet,
        decor: pet.decor.includes(item.id) ? pet.decor.filter((d) => d !== item.id) : [...pet.decor, item.id],
      });
    if (item.shelf === "walls") putPet({ ...pet, wallpaper: item.id });
    if (item.shelf === "pets") {
      const species = speciesOf(item.id)!;
      const index = home?.pets.findIndex((p) => p.species === species) ?? -1;
      setPanel(null);
      if (index >= 0) switchTo(index);
      else setAdopting(species);
    }
  };

  const toggleSound = () => {
    sound.on = !soundOn;
    setSoundOn(!soundOn);
    saveSound(sdk, !soundOn);
  };

  // ---- Screens ------------------------------------------------------------

  if (home === undefined) return <div className="pawpal loading">{t("Loading…")}</div>;

  if (!home || !pet || adopting) {
    return (
      <Adopt
        owned={owned}
        raised={home?.pets.map((p) => p.species) ?? []}
        initial={adopting}
        canCancel={!!pet}
        onCancel={() => setAdopting(null)}
        onAdopt={adopt}
        onBuy={(species) => {
          const item = CATALOG.find((i) => i.id === `pet-${species}`);
          if (item) void buyItem(item);
        }}
      />
    );
  }

  const left = daysToGrow(pet);
  const want = wish(pet);
  const bubblePos = sceneRef.current?.headOnScreen();

  return (
    <div className="pawpal">
      <canvas ref={canvasRef} className="room" aria-label={t("{0}'s room", pet.name)} />
      {noWebgl && (
        <button className="flat-pet" onClick={() => tapRef.current(pet.hatched ? "pet" : "egg")}>
          {pet.hatched ? <PetFace species={pet.species} size={200} happy={petMood === "joyful"} sad={petMood === "sad"} /> : <span className="flat-egg" />}
        </button>
      )}
      {bubble && (
        <div
          className="bubble"
          key={bubble.at}
          style={bubblePos ? { left: bubblePos.x, top: bubblePos.y } : undefined}
          role="status"
        >
          {bubble.text(t)}
        </div>
      )}

      <header className="hud-top">
        <div className="pet-card">
          {home.pets.length > 1 && (
            <div className="pet-switch" role="group" aria-label={t("Your pets")}>
              {home.pets.map((p, i) => (
                <button
                  key={p.species}
                  className={i === home.active ? "on" : ""}
                  aria-label={p.name}
                  aria-pressed={i === home.active}
                  onClick={() => switchTo(i)}
                >
                  <PetFace species={p.species} size={34} />
                </button>
              ))}
            </div>
          )}
          <h1>{pet.name}</h1>
          <p className="stage">
            {!pet.hatched
              ? t("An egg · tap it to hatch")
              : left
                ? t("{0} · grows up after {1} more days of care", t(STAGE_NAME[petStage]), left)
                : t("All grown up")}
          </p>
          {pet.streak > 0 && <p className="streak">{t("{0}-day care streak", pet.streak)}</p>}
        </div>
        <div className="hud-right">
          <span className="treats" title={t("Treats")}>
            <span className="treat-dot" aria-hidden="true" /> {t("{0} treats", pet.treats)}
          </span>
          <button className="icon-button" onClick={toggleSound} aria-pressed={soundOn}>
            {soundOn ? t("Sound on") : t("Sound off")}
          </button>
        </div>
      </header>

      {!signedIn && (
        <div className="signin-banner">
          <span>{t("Sign in to earn coins and badges, and keep {0} on every device.", pet.name)}</span>
          <button className="button small" onClick={() => sdk.requestSignIn()}>
            {t("Sign in")}
          </button>
        </div>
      )}

      {pet.hatched && !game && (
        <aside className="needs" aria-label={t("How {0} feels", pet.name)}>
          <p className={`mood mood-${petMood}`}>
            {t(MOOD_NAME[petMood])}
            {want && <span> · {t(WISH[want])}</span>}
          </p>
          {NEEDS.map((need) => (
            <div key={need} className="need">
              <span>{t(NEED_NAME[need])}</span>
              <div
                className="bar"
                role="meter"
                aria-label={t(NEED_NAME[need])}
                aria-valuenow={Math.round(pet.needs[need])}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i className={`fill fill-${need}`} style={{ width: `${pet.needs[need]}%` }} />
              </div>
            </div>
          ))}
        </aside>
      )}

      {pet.hatched && !game && (
        <nav className="actions" aria-label={t("Care")}>
          <button className="action" onClick={() => doCare("feed")}>
            {t("Feed")}
          </button>
          <button className="action" onClick={() => doCare("treat")}>
            {t("Treat ({0})", pet.treats)}
          </button>
          <button className="action" onClick={() => doCare("play")}>
            {t("Play")}
          </button>
          <button className="action" onClick={() => doCare("bathe")}>
            {t("Bathe")}
          </button>
          <button className="action" onClick={() => doCare("pet")}>
            {t("Pet")}
          </button>
          <span className="divider" />
          <button className="action alt" onClick={() => setPanel("games")}>
            {t("Games")}
          </button>
          <button className="action alt shop" onClick={() => setPanel("shop")}>
            {t("Shop")}
          </button>
        </nav>
      )}

      {panel === "games" && (
        <Drawer title={t("Play together")} onClose={() => setPanel(null)}>
          <p className="muted">
            {t("Every round wins treats and makes {0} happy. Signed-in players also earn coins.", pet.name)}
          </p>
          {(
            [
              ["catch", "Treat Catch", "Catch falling treats before time runs out."],
              ["seek", "Hide and Seek", "Follow the box {0} hides in."],
              ["dance", "Dance Along", "Copy {0}'s dance moves."],
            ] as const
          ).map(([id, title, text]) => (
            <button
              key={id}
              className="game-card"
              onClick={() => {
                setPanel(null);
                setGame(id);
              }}
            >
              <strong>{t(title)}</strong>
              <span>{t(text, pet.name)}</span>
            </button>
          ))}
          <div className="earn-box">
            <h3>{t("Ways to earn coins")}</h3>
            <ul>
              <li>{t("Visit every day: 5 coins, up to 10 with a streak")}</li>
              <li>{t("Mini-games: up to 10 coins a round")}</li>
              <li>{t("Badges: hatch, grow up, streaks and high scores")}</li>
            </ul>
          </div>
        </Drawer>
      )}

      {panel === "shop" && (
        <Drawer
          title={t("Shop")}
          onClose={() => {
            setPanel(null);
            setPreview(null);
          }}
        >
          <p className="muted">
            {signedIn
              ? t("Everything is bought once with dingn coins and kept. Try things on first!")
              : t("Sign in to buy with dingn coins. You can still try things on.")}
          </p>
          <div className="tabs" role="tablist">
            {SHELVES.map((s) => (
              <button key={s} role="tab" aria-selected={shelf === s} onClick={() => setShelf(s)}>
                {t(SHELF_NAME[s])}
              </button>
            ))}
          </div>
          <ul className="shelf">
            {shelf === "walls" && (
              <li className="item">
                <span className="swatch wall-plain" />
                <span className="item-name">{t("Plain wallpaper")}</span>
                <span className="item-actions">
                  <button
                    className="secondary-button"
                    disabled={!pet.wallpaper}
                    onClick={() => putPet({ ...pet, wallpaper: "" })}
                  >
                    {pet.wallpaper ? t("Use") : t("In use")}
                  </button>
                </span>
              </li>
            )}
            {CATALOG.filter((i) => i.shelf === shelf).map((item) => {
              const has = owned.has(item.id);
              const inUse =
                pet.outfit === item.id || pet.decor.includes(item.id) || pet.wallpaper === item.id;
              const raised = item.shelf === "pets" && home.pets.some((p) => `pet-${p.species}` === item.id);
              const locked = !!item.requires && !owned.has(item.requires);
              return (
                <li key={item.id} className={`item${preview === item.id ? " trying" : ""}`}>
                  <ItemIcon id={item.id} />
                  <span className="item-name">{t(item.title.en)}</span>
                  <span className="item-actions">
                    {has ? (
                      item.shelf === "helpers" ? (
                        <span className="owned">{t("Working")}</span>
                      ) : item.shelf === "pets" ? (
                        <button className="secondary-button" onClick={() => useItem(item)}>
                          {raised ? t("Visit") : t("Hatch")}
                        </button>
                      ) : (
                        <button className="secondary-button" onClick={() => useItem(item)}>
                          {item.shelf === "outfits"
                            ? inUse
                              ? t("Take off")
                              : t("Wear")
                            : item.shelf === "decor"
                              ? inUse
                                ? t("Put away")
                                : t("Place")
                              : inUse
                                ? t("In use")
                                : t("Use")}
                        </button>
                      )
                    ) : (
                      <>
                        {item.shelf !== "helpers" && item.shelf !== "pets" && (
                          <button
                            className="secondary-button"
                            aria-pressed={preview === item.id}
                            onClick={() => setPreview(preview === item.id ? null : item.id)}
                          >
                            {preview === item.id ? t("Stop trying") : t("Try")}
                          </button>
                        )}
                        <button className="button small" disabled={locked} onClick={() => void buyItem(item)}>
                          {locked ? t("Needs the one before") : t("{0} coins", item.price)}
                        </button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Drawer>
      )}

      {game === "catch" && (
        <TreatCatch species={pet.species} onDone={(s) => endGame("catch", s)} onQuit={() => setGame(null)} />
      )}
      {game === "seek" && (
        <HideAndSeek species={pet.species} onDone={(s) => endGame("seek", s)} onQuit={() => setGame(null)} />
      )}
      {game === "dance" && (
        <DanceAlong
          species={pet.species}
          onDone={(s) => endGame("dance", s)}
          onQuit={() => setGame(null)}
          onMove={onDanceMove}
        />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((x) => (
          <div key={x.id} className={`toast toast-${x.kind}`}>
            {x.kind === "coin" && <span className="coin" aria-hidden="true" />}
            {x.text(t)}
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGE_NAME = { egg: "Egg", baby: "Baby", kid: "Kid", grown: "Grown-up" } as const;
const MOOD_NAME = {
  joyful: "Joyful",
  happy: "Happy",
  okay: "Okay",
  sad: "Sad",
} as const;

function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  return (
    <section className="drawer" role="dialog" aria-label={title}>
      <div className="drawer-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label={t("Close")}>
          ×
        </button>
      </div>
      {children}
    </section>
  );
}

const ICON_COLORS: Record<string, string> = {
  "outfit-bow": "#ff6f9a",
  "outfit-scarf": "#e8454f",
  "outfit-cap": "#3f8cff",
  "outfit-glasses": "#30283a",
  "outfit-flowers": "#ffd34d",
  "outfit-cape": "#c23b58",
  "outfit-wizard": "#6b4bd6",
  "outfit-crown": "#ffc53a",
  "decor-rug": "#ff9e8a",
  "decor-plant": "#4fae5c",
  "decor-painting": "#9fd8ff",
  "decor-lamp": "#fff2c2",
  "decor-toybox": "#5fb6e8",
  "decor-fishbowl": "#ff8a3a",
  "decor-lights": "#ff8fb1",
  "decor-cloudbed": "#ffffff",
  "wall-mint": "#cdeedd",
  "wall-sky": "#cfe5fb",
  "wall-peach": "#ffd8c6",
  "wall-stars": "#2f3768",
  "jar-1": "#c98a4a",
  "jar-2": "#c98a4a",
  "jar-3": "#c98a4a",
  feeder: "#4fa3e8",
  mat: "#7ee081",
  vitamins: "#ffb347",
};
function ItemIcon({ id }: { id: string }) {
  const species = speciesOf(id);
  if (species)
    return (
      <span className="swatch">
        <PetFace species={species} size={40} />
      </span>
    );
  return <span className={`swatch${id === "wall-stars" ? " wall-stars" : ""}`} style={{ background: ICON_COLORS[id] }} />;
}

function Adopt({
  owned,
  raised,
  initial,
  canCancel,
  onCancel,
  onAdopt,
  onBuy,
}: {
  owned: Set<string>;
  raised: Species[];
  initial: Species | null;
  canCancel: boolean;
  onCancel: () => void;
  onAdopt: (species: Species, name: string) => void;
  onBuy: (species: Species) => void;
}) {
  const { t } = useLocale();
  const sdk = useDingn();
  const first = initial ?? SPECIES.find((s) => !raised.includes(s.id))?.id ?? "puppy";
  const [species, setSpecies] = useState<Species>(first);
  // A suggested name follows the language until the player types their own.
  const [suggested, setSuggested] = useState(NAMES[first][0]);
  const [typed, setTyped] = useState<string | null>(null);
  const name = typed ?? t(suggested);
  const choose = (s: Species) => {
    setSpecies(s);
    setSuggested(NAMES[s][Math.floor(Math.random() * NAMES[s].length)]);
    setTyped(null);
  };
  const entry = SPECIES.find((s) => s.id === species)!;
  const unlocked = !entry.shop || owned.has(entry.shop);
  const taken = raised.includes(species);
  const price = CATALOG.find((i) => i.id === entry.shop)?.price ?? 0;
  return (
    <div className="pawpal adopt">
      <div className="adopt-card">
        <p className="eyebrow">{t("Pawpal")}</p>
        <h1>{raised.length ? t("Hatch a new friend") : t("Choose your pet")}</h1>
        <p className="muted">
          {t("Your pet hatches from an egg and grows up over the days you care for it.")}
        </p>
        <div className="species" role="radiogroup" aria-label={t("Pet")}>
          {SPECIES.map((s) => {
            const has = !s.shop || owned.has(s.shop);
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={species === s.id}
                className={`species-card${species === s.id ? " on" : ""}`}
                onClick={() => choose(s.id)}
              >
                <PetFace species={s.id} size={84} happy={species === s.id} />
                <strong>{t(SPECIES_NAME[s.id])}</strong>
                <small>
                  {raised.includes(s.id)
                    ? t("Already yours")
                    : has
                      ? t("Free")
                      : t("{0} coins", CATALOG.find((i) => i.id === s.shop)?.price ?? 0)}
                </small>
              </button>
            );
          })}
        </div>
        {taken ? (
          <p className="muted">{t("You're already raising this one. Pick another!")}</p>
        ) : unlocked ? (
          <form
            className="name-form"
            onSubmit={(e) => {
              e.preventDefault();
              onAdopt(species, name);
            }}
          >
            <label>
              {t("Name")}
              <input value={name} maxLength={MAX_NAME} onChange={(e) => setTyped(e.target.value)} />
            </label>
            <button className="button" type="submit">
              {t("Choose this egg")}
            </button>
          </form>
        ) : (
          <div className="name-form">
            <p className="muted">
              {sdk.player.signedIn
                ? t("The {0} egg costs {1} coins. Puppy and kitten are always free.", t(SPECIES_NAME[species]), price)
                : t("Sign in to get the {0} egg with dingn coins. Puppy and kitten are always free.", t(SPECIES_NAME[species]))}
            </p>
            <button className="button" onClick={() => onBuy(species)}>
              {sdk.player.signedIn ? t("Get the egg · {0} coins", price) : t("Sign in")}
            </button>
          </div>
        )}
        {canCancel && (
          <button className="link-button" onClick={onCancel}>
            {t("Back to my pet")}
          </button>
        )}
      </div>
    </div>
  );
}
