/**
 * The three mini-games played with the pet. Each calls onDone(score) once,
 * and nothing in them can be lost or bought: a round always pays something.
 */
import { useEffect, useRef, useState } from "react";
import type { Species } from "./pet-core";
import { PetFace } from "./pet-face";
import type { DanceMove } from "./pet-scene";
import { useLocale } from "./dingn";

type Props = { species: Species; onDone: (score: number) => void; onQuit: () => void };

// ---------------------------------------------------------------------------
// Treat Catch: move the pet left and right to catch falling treats.

const CATCH_SECONDS = 30;
const W = 640;
const H = 400;
type Falling = { x: number; y: number; v: number; gold: boolean; kind: number };

export function TreatCatch({ species, onDone, onQuit }: Props) {
  const { t } = useLocale();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(CATCH_SECONDS);
  const done = useRef(false);
  const state = useRef({ x: W / 2, keys: 0, items: [] as Falling[], score: 0, time: 0, spawn: 0 });
  const face = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    // The pet's face, drawn from the same picture the cards use.
    const svg = document.getElementById("catch-face")?.innerHTML;
    if (svg && typeof Image !== "undefined") {
      const img = new Image();
      img.src =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(svg.includes("xmlns") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"'));
      face.current = img;
    }
    const s = state.current;
    const key = (e: KeyboardEvent, down: boolean) => {
      const bit = e.key === "ArrowLeft" || e.key === "a" ? 1 : e.key === "ArrowRight" || e.key === "d" ? 2 : 0;
      if (!bit) return;
      e.preventDefault();
      s.keys = down ? s.keys | bit : s.keys & ~bit;
    };
    const kd = (e: KeyboardEvent) => key(e, true);
    const ku = (e: KeyboardEvent) => key(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    let raf = 0;
    let last = performance.now();
    const g = canvas.current?.getContext("2d") ?? null;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.time += dt;
      if (s.keys & 1) s.x -= 420 * dt;
      if (s.keys & 2) s.x += 420 * dt;
      s.x = Math.max(40, Math.min(W - 40, s.x));
      s.spawn -= dt;
      const speedUp = 1 + s.time / 20;
      if (s.spawn <= 0) {
        s.spawn = 0.55 / speedUp;
        s.items.push({
          x: 30 + Math.random() * (W - 60),
          y: -20,
          v: (130 + Math.random() * 70) * speedUp,
          gold: Math.random() < 0.1,
          kind: Math.floor(Math.random() * 3),
        });
      }
      for (const it of s.items) it.y += it.v * dt;
      const caught = s.items.filter((it) => it.y > H - 80 && it.y < H - 30 && Math.abs(it.x - s.x) < 44);
      if (caught.length) {
        s.score += caught.reduce((n, it) => n + (it.gold ? 3 : 1), 0);
        setScore(s.score);
      }
      s.items = s.items.filter((it) => !caught.includes(it) && it.y < H + 30);
      const remaining = Math.max(0, CATCH_SECONDS - s.time);
      setLeft(Math.ceil(remaining));
      if (remaining <= 0 && !done.current) {
        done.current = true;
        cancelAnimationFrame(raf);
        onDone(s.score);
        return;
      }
      if (!g) return;
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#bfe6ff");
      sky.addColorStop(1, "#fff4e2");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#9ad57a";
      g.fillRect(0, H - 30, W, 30);
      for (const it of s.items) drawTreat(g, it);
      if (face.current?.complete) g.drawImage(face.current, s.x - 45, H - 105, 90, 90);
      else {
        g.fillStyle = "#e3a866";
        g.beginPath();
        g.arc(s.x, H - 60, 38, 0, Math.PI * 2);
        g.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [onDone]);

  const pointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    state.current.x = ((e.clientX - r.left) / r.width) * W;
  };
  return (
    <div className="game-panel" role="dialog" aria-label={t("Treat Catch")}>
      <div className="game-head">
        <h2>{t("Treat Catch")}</h2>
        <span>{t("Caught {0}", String(score))}</span>
        <span>{t("{0}s left", String(left))}</span>
        <button className="secondary-button" onClick={onQuit}>
          {t("Stop")}
        </button>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        className="catch-canvas"
        onPointerMove={pointer}
        onPointerDown={pointer}
      />
      <p className="hint">{t("Move with the mouse or the arrow keys. Gold stars are worth 3.")}</p>
      <div id="catch-face" hidden>
        <PetFace species={species} size={90} happy />
      </div>
    </div>
  );
}

function drawTreat(g: CanvasRenderingContext2D, it: Falling) {
  g.save();
  g.translate(it.x, it.y);
  if (it.gold) {
    g.fillStyle = "#ffcf3a";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 16;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.fill();
  } else if (it.kind === 0) {
    g.fillStyle = "#c98a4a";
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#5a3520";
    for (const [x, y] of [[-5, -4], [4, 3], [-2, 6], [6, -6]]) g.fillRect(x, y, 3, 3);
  } else if (it.kind === 1) {
    g.fillStyle = "#fff6e6";
    g.fillRect(-12, -4, 24, 8);
    for (const x of [-12, 12]) for (const y of [-5, 5]) {
      g.beginPath();
      g.arc(x, y, 6, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.fillStyle = "#ff8fb1";
    g.beginPath();
    g.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.fillRect(-3, -10, 6, 4);
  }
  g.restore();
}

// ---------------------------------------------------------------------------
// Hide and Seek: watch which box the pet hides in, follow the shuffle, pick it.

type SeekPhase = "peek" | "shuffle" | "pick" | "found" | "missed";

export function HideAndSeek({ species, onDone, onQuit }: Props) {
  const { t } = useLocale();
  const [found, setFound] = useState(0);
  const boxes = found >= 6 ? 5 : found >= 3 ? 4 : 3;
  // slot[i] = the box that sits in place i; the pet is in box 0.
  const [slots, setSlots] = useState<number[]>(() => [...Array(boxes).keys()]);
  const [phase, setPhase] = useState<SeekPhase>("peek");
  const [picked, setPicked] = useState(-1);
  const round = useRef(0);

  useEffect(() => {
    const id = ++round.current;
    let order = [...Array(boxes).keys()].sort(() => Math.random() - 0.5);
    setSlots(order);
    setPhase("peek");
    setPicked(-1);
    const swaps = 4 + found;
    const speed = Math.max(240, 520 - found * 30);
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        if (id !== round.current) return;
        setPhase("shuffle");
        for (let i = 0; i < swaps; i++)
          timers.push(
            setTimeout(() => {
              const a = Math.floor(Math.random() * boxes);
              let b = Math.floor(Math.random() * (boxes - 1));
              if (b >= a) b++;
              order = [...order];
              [order[a], order[b]] = [order[b], order[a]];
              setSlots(order);
              if (i === swaps - 1) timers.push(setTimeout(() => setPhase("pick"), speed));
            }, i * speed),
          );
      }, 1300),
    );
    return () => timers.forEach(clearTimeout);
  }, [found, boxes]);

  const pick = (place: number) => {
    if (phase !== "pick") return;
    setPicked(place);
    if (slots[place] === 0) {
      setPhase("found");
      setTimeout(() => setFound((n) => n + 1), 900);
    } else {
      setPhase("missed");
      setTimeout(() => onDone(found), 1500);
    }
  };
  const width = 100 / boxes;
  return (
    <div className="game-panel" role="dialog" aria-label={t("Hide and Seek")}>
      <div className="game-head">
        <h2>{t("Hide and Seek")}</h2>
        <span>{t("Found {0} in a row", String(found))}</span>
        <button className="secondary-button" onClick={onQuit}>
          {t("Stop")}
        </button>
      </div>
      <p className="seek-say" aria-live="polite">
        {phase === "peek"
          ? t("Watch where I hide!")
          : phase === "shuffle"
            ? t("Keep your eye on my box…")
            : phase === "pick"
              ? t("Where am I?")
              : phase === "found"
                ? t("You found me!")
                : t("Here I was! Good try.")}
      </p>
      <div className="seek-floor">
        {[...Array(boxes).keys()].map((box) => {
          const place = slots.indexOf(box);
          const open =
            (phase === "peek" && box === 0) ||
            ((phase === "found" || phase === "missed") && (box === 0 || place === picked));
          return (
            <button
              key={box}
              className={`seek-box${open ? " open" : ""}`}
              style={{ left: `${place * width + width / 2}%`, transitionDuration: `${Math.max(200, 480 - found * 30)}ms` }}
              aria-label={t("Box {0}", String(place + 1))}
              disabled={phase !== "pick"}
              onClick={() => pick(place)}
            >
              {open && box === 0 && (
                <span className="seek-pet">
                  <PetFace species={species} size={70} happy={phase !== "missed"} />
                </span>
              )}
              <span className="seek-lid" />
              <span className="seek-crate" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dance Along: the pet dances a few moves; copy them. One more move each turn.

const MOVES: DanceMove[] = ["left", "right", "jump", "spin"];
const MOVE_KEY: Record<string, DanceMove> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "jump",
  ArrowDown: "spin",
};
const MOVE_LABEL: Record<DanceMove, string> = { left: "←", right: "→", jump: "↑", spin: "↻" };

export function DanceAlong({
  onDone,
  onQuit,
  onMove,
}: Props & { onMove: (move: DanceMove) => void }) {
  const { t } = useLocale();
  const [seq, setSeq] = useState<DanceMove[]>(() => [MOVES[Math.floor(Math.random() * 4)]]);
  const [showing, setShowing] = useState(true);
  const [lit, setLit] = useState<DanceMove | null>(null);
  const [step, setStep] = useState(0);
  const [missed, setMissed] = useState(false);
  const best = seq.length - 1;

  useEffect(() => {
    setShowing(true);
    setStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    const beat = Math.max(420, 750 - seq.length * 25);
    seq.forEach((move, i) => {
      timers.push(
        setTimeout(() => {
          setLit(move);
          onMove(move);
        }, 700 + i * beat),
      );
      timers.push(setTimeout(() => setLit(null), 700 + i * beat + beat * 0.6));
    });
    timers.push(setTimeout(() => setShowing(false), 700 + seq.length * beat));
    return () => timers.forEach(clearTimeout);
  }, [seq, onMove]);

  const press = (move: DanceMove) => {
    if (showing || missed) return;
    onMove(move);
    setLit(move);
    setTimeout(() => setLit(null), 200);
    if (move !== seq[step]) {
      setMissed(true);
      setTimeout(() => onDone(best), 1300);
      return;
    }
    if (step + 1 === seq.length)
      setTimeout(() => setSeq((s) => [...s, MOVES[Math.floor(Math.random() * 4)]]), 500);
    else setStep(step + 1);
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const move = MOVE_KEY[e.key];
      if (!move) return;
      e.preventDefault();
      pressRef.current(move);
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, []);

  return (
    <div className="dance-bar" role="dialog" aria-label={t("Dance Along")}>
      <div className="game-head">
        <h2>{t("Dance Along")}</h2>
        <span>{t("{0} moves", String(best))}</span>
        <button className="secondary-button" onClick={onQuit}>
          {t("Stop")}
        </button>
      </div>
      <p className="seek-say" aria-live="polite">
        {missed
          ? t("Oops! Great dancing anyway.")
          : showing
            ? t("Watch my moves…")
            : t("Your turn! {0} to go", String(seq.length - step))}
      </p>
      <div className="dance-pads">
        {MOVES.map((move) => (
          <button
            key={move}
            className={`dance-pad${lit === move ? " lit" : ""}`}
            disabled={showing || missed}
            aria-label={t(move === "left" ? "Hop left" : move === "right" ? "Hop right" : move === "jump" ? "Jump" : "Spin")}
            onClick={() => press(move)}
          >
            {MOVE_LABEL[move]}
          </button>
        ))}
      </div>
    </div>
  );
}
