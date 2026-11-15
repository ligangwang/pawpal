/**
 * The 3D room and the pet, built from simple shapes so every piece of art is
 * Pawpal's own and nothing is downloaded. The React side tells the scene what
 * to show (setPet, setRoom, setMood) and what just happened (act); the scene
 * animates it and reports taps on the pet.
 */
import * as THREE from "three";
import type { Mood, Species, Stage } from "./pet-core";

export type Action =
  | "feed"
  | "treat"
  | "play"
  | "bathe"
  | "pet"
  | "wave"
  | "egg"
  | "hatch"
  | "grow"
  | "buy"
  | DanceMove;
export type DanceMove = "left" | "right" | "jump" | "spin";

export type PetView = {
  species: Species;
  stage: Stage;
  outfit: string;
};
export type RoomView = { decor: string[]; wallpaper: string };

type Palette = { body: number; accent: number; belly: number; extra: number };
const PALETTE: Record<Species, Palette> = {
  puppy: { body: 0xe3a866, accent: 0x8c5a33, belly: 0xfff1dc, extra: 0x2b2026 },
  kitten: { body: 0xb8bdd6, accent: 0x8a90ad, belly: 0xf5f3fb, extra: 0xffa8b8 },
  fox: { body: 0xed7a33, accent: 0x3b2b24, belly: 0xfff6ec, extra: 0xffffff },
  dragon: { body: 0x6fd29f, accent: 0xffcf5a, belly: 0xfff0b8, extra: 0x4cae7c },
};
export const PET_COLORS = PALETTE;

const WALLS: Record<string, number> = {
  "": 0xf6ead6,
  "wall-mint": 0xcdeedd,
  "wall-sky": 0xcfe5fb,
  "wall-peach": 0xffd8c6,
  "wall-stars": 0x2f3768,
};
const STAGE_SIZE: Record<Stage, number> = { egg: 1, baby: 0.62, kid: 0.8, grown: 1 };

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
function mesh(
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const ball = (r: number, color: number, s?: [number, number, number]) => {
  const m = mesh(new THREE.SphereGeometry(r, 24, 16), mat(color));
  if (s) m.scale.set(...s);
  return m;
};

type PetParts = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  eyesOpen: THREE.Object3D[];
  eyesHappy: THREE.Object3D[];
  smile: THREE.Object3D;
  frown: THREE.Object3D;
  open: THREE.Object3D;
  tail: THREE.Object3D;
  wings: THREE.Object3D[];
  ears: THREE.Object3D[];
};

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.9, 0.1, -0.5, 0.75, 0, 0.35);
  s.bezierCurveTo(0.5, 0.75, 0.9, 0.1, 0, -0.5);
  return new THREE.ShapeGeometry(s);
}
function starShape(points = 5, outer = 0.5, inner = 0.22) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s);
}

/** Builds a pet of the given species, about 1.6 units tall when grown. */
function buildPet(species: Species): PetParts {
  const c = PALETTE[species];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  body.add(ball(0.5, c.body, [1, 0.88, 1.08]));
  body.children[0].position.y = 0.55;
  const belly = ball(0.36, c.belly, [0.9, 0.9, 0.5]);
  belly.position.set(0, 0.5, 0.3);
  body.add(belly);
  for (const [x, z] of [
    [-0.26, 0.28],
    [0.26, 0.28],
    [-0.26, -0.28],
    [0.26, -0.28],
  ]) {
    const leg = ball(0.15, species === "fox" ? c.accent : c.body, [1, 1.25, 1.1]);
    leg.position.set(x, 0.15, z);
    body.add(leg);
  }

  // Tail.
  const tail = new THREE.Group();
  tail.position.set(0, 0.6, -0.5);
  if (species === "puppy") {
    const t = ball(0.12, c.body, [0.8, 0.8, 1.9]);
    t.position.set(0, 0.12, -0.12);
    t.rotation.x = 0.8;
    tail.add(t);
  } else if (species === "kitten") {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.25, -0.25),
      new THREE.Vector3(0, 0.6, -0.3),
      new THREE.Vector3(0.1, 0.8, -0.15),
    ]);
    tail.add(mesh(new THREE.TubeGeometry(curve, 24, 0.065, 10), mat(c.accent)));
  } else if (species === "fox") {
    const t = ball(0.24, c.body, [0.95, 0.95, 2]);
    t.position.set(0, 0.2, -0.32);
    t.rotation.x = 0.55;
    const tip = ball(0.18, c.extra, [1, 1, 1.3]);
    tip.position.set(0, 0.45, -0.68);
    tail.add(t, tip);
  } else {
    const t = mesh(new THREE.ConeGeometry(0.17, 0.8, 16), mat(c.body));
    t.rotation.x = -1.9;
    t.position.set(0, -0.1, -0.35);
    const spike = mesh(new THREE.ConeGeometry(0.1, 0.2, 4), mat(c.accent));
    spike.position.set(0, -0.06, -0.75);
    spike.rotation.x = -1.2;
    tail.add(t, spike);
  }
  body.add(tail);

  // Dragon wings.
  const wings: THREE.Object3D[] = [];
  if (species === "dragon") {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.55, 0.35);
    shape.lineTo(0.62, -0.05);
    shape.lineTo(0.4, 0.02);
    shape.lineTo(0.38, -0.2);
    shape.lineTo(0.18, -0.08);
    shape.lineTo(0, -0.18);
    const geo = new THREE.ShapeGeometry(shape);
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.18 * side, 0.85, -0.2);
      const w = mesh(geo, mat(c.extra, { side: THREE.DoubleSide }));
      w.scale.x = side;
      w.rotation.y = side * 0.5;
      pivot.add(w);
      body.add(pivot);
      wings.push(pivot);
    }
    for (let i = 0; i < 3; i++) {
      const spike = mesh(new THREE.ConeGeometry(0.06, 0.16, 4), mat(c.accent));
      spike.position.set(0, 1.0 - i * 0.12, -0.2 - i * 0.18);
      spike.rotation.x = -0.4 - i * 0.3;
      body.add(spike);
    }
  }

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.12, 0.22);
  body.add(head);
  head.add(ball(0.44, c.body, [1.05, 0.95, 0.95]));
  const muzzle = ball(0.19, c.belly, species === "kitten" ? [1, 0.7, 0.7] : [1.15, 0.8, 0.95]);
  muzzle.position.set(0, -0.12, 0.35);
  head.add(muzzle);
  const nose = ball(0.055, species === "kitten" ? c.extra : 0x2b2026, [1.3, 0.9, 1]);
  nose.position.set(0, -0.05, 0.53);
  head.add(nose);
  for (const side of [-1, 1]) {
    const cheek = mesh(
      new THREE.CircleGeometry(0.07, 20),
      new THREE.MeshBasicMaterial({ color: 0xff9fb0, transparent: true, opacity: 0.7 }),
    );
    cheek.position.set(0.27 * side, -0.08, 0.36);
    cheek.rotation.y = side * 0.6;
    head.add(cheek);
  }

  // Ears or horns.
  const ears: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    if (species === "puppy") {
      const e = ball(0.16, c.accent, [0.6, 1.35, 0.45]);
      e.position.y = -0.14;
      ear.add(e);
      ear.position.set(0.38 * side, 0.12, 0);
      ear.rotation.z = side * 0.35;
    } else if (species === "kitten" || species === "fox") {
      const big = species === "fox";
      const e = mesh(new THREE.ConeGeometry(big ? 0.16 : 0.14, big ? 0.38 : 0.28, 4), mat(c.body));
      e.rotation.y = Math.PI / 4;
      const inner = mesh(
        new THREE.ConeGeometry(big ? 0.09 : 0.08, big ? 0.24 : 0.17, 4),
        mat(big ? c.accent : c.extra),
      );
      inner.position.set(0, -0.02, 0.06);
      inner.rotation.y = Math.PI / 4;
      ear.add(e, inner);
      ear.position.set(0.25 * side, 0.4, -0.02);
      ear.rotation.z = -side * 0.25;
    } else {
      const horn = mesh(new THREE.ConeGeometry(0.065, 0.26, 12), mat(c.accent));
      horn.position.y = 0.1;
      ear.add(horn);
      ear.position.set(0.18 * side, 0.38, -0.08);
      ear.rotation.set(-0.45, 0, -side * 0.2);
      const fin = mesh(new THREE.ConeGeometry(0.08, 0.2, 3), mat(c.extra));
      fin.position.set(0.25 * side, -0.25, -0.05);
      fin.rotation.z = -side * 1.3;
      ear.add(fin);
    }
    head.add(ear);
    ears.push(ear);
  }

  // Eyes: round open eyes, and happy "^" arcs shown when the pet is joyful.
  const eyesOpen: THREE.Object3D[] = [];
  const eyesHappy: THREE.Object3D[] = [];
  const dark = mat(0x251f2b, { roughness: 0.3 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const e = mesh(new THREE.SphereGeometry(0.075, 20, 14), dark);
    e.scale.set(1, 1.25, 0.6);
    const shine = mesh(
      new THREE.SphereGeometry(0.025, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      0.025,
      0.035,
      0.04,
    );
    eye.add(e, shine);
    eye.position.set(0.16 * side, 0.05, 0.39);
    head.add(eye);
    eyesOpen.push(eye);
    const arc = mesh(new THREE.TorusGeometry(0.06, 0.017, 8, 20, Math.PI), dark);
    arc.position.set(0.16 * side, 0.03, 0.41);
    head.add(arc);
    eyesHappy.push(arc);
  }
  const mouthMat = mat(0x3a1f26);
  const smile = mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 20, Math.PI), mouthMat);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.16, 0.5);
  const frown = mesh(new THREE.TorusGeometry(0.05, 0.013, 8, 20, Math.PI), mouthMat);
  frown.position.set(0, -0.22, 0.49);
  const open = ball(0.06, 0xd8566c, [1.1, 0.9, 0.5]);
  open.position.set(0, -0.19, 0.5);
  head.add(smile, frown, open);

  root.traverse((o) => {
    o.userData.pet = true;
  });
  return { root, body, head, eyesOpen, eyesHappy, smile, frown, open, tail, wings, ears };
}

/** An outfit, placed on the pet's head or body. */
function buildOutfit(id: string, parts: PetParts): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const onHead = (o: THREE.Object3D) => {
    parts.head.add(o);
    out.push(o);
  };
  const onBody = (o: THREE.Object3D) => {
    parts.body.add(o);
    out.push(o);
  };
  if (id === "outfit-bow") {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const loop = ball(0.1, 0xff6f9a, [1.3, 0.8, 0.5]);
      loop.position.x = 0.1 * side;
      g.add(loop);
    }
    g.add(ball(0.05, 0xff3f7a));
    g.position.set(0.24, 0.36, 0.12);
    g.rotation.z = -0.4;
    onHead(g);
  } else if (id === "outfit-scarf") {
    const ring = mesh(new THREE.TorusGeometry(0.33, 0.08, 12, 32), mat(0xe8454f));
    ring.rotation.x = Math.PI / 2 - 0.2;
    ring.position.set(0, 0.86, 0.12);
    const end = mesh(new THREE.BoxGeometry(0.14, 0.32, 0.06), mat(0xe8454f));
    end.position.set(0.18, 0.7, 0.42);
    end.rotation.z = 0.2;
    onBody(ring);
    onBody(end);
  } else if (id === "outfit-cap") {
    const g = new THREE.Group();
    const dome = mesh(
      new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(0x3f8cff),
    );
    const brim = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 24), mat(0x2f6fd6));
    brim.position.set(0, 0, 0.26);
    brim.scale.z = 1.2;
    g.add(dome, brim);
    g.position.set(0, 0.3, 0);
    onHead(g);
  } else if (id === "outfit-glasses") {
    const g = new THREE.Group();
    const m = mat(0x30283a, { roughness: 0.3 });
    for (const side of [-1, 1]) {
      const rim = mesh(new THREE.TorusGeometry(0.1, 0.016, 8, 24), m);
      rim.position.x = 0.16 * side;
      g.add(rim);
    }
    const bridge = mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), m);
    g.add(bridge);
    g.position.set(0, 0.05, 0.44);
    onHead(g);
  } else if (id === "outfit-flowers") {
    const g = new THREE.Group();
    const colors = [0xff6f9a, 0xffd34d, 0xffffff, 0x9b7bff, 0x6fd3ff];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = ball(0.07, colors[i % colors.length]);
      f.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      g.add(f);
    }
    g.position.y = 0.34;
    g.rotation.x = 0.15;
    onHead(g);
  } else if (id === "outfit-cape") {
    const cape = mesh(
      new THREE.CylinderGeometry(0.4, 0.62, 0.8, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8),
      mat(0xc23b58, { side: THREE.DoubleSide }),
    );
    cape.position.set(0, 0.55, -0.02);
    onBody(cape);
    const clasp = ball(0.06, 0xffd34d);
    clasp.position.set(0, 0.92, 0.35);
    onBody(clasp);
  } else if (id === "outfit-wizard") {
    const g = new THREE.Group();
    const cone = mesh(new THREE.ConeGeometry(0.26, 0.6, 24), mat(0x6b4bd6));
    cone.position.y = 0.3;
    cone.rotation.z = -0.15;
    const brim = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 32), mat(0x553bb0));
    g.add(cone, brim);
    for (let i = 0; i < 4; i++) {
      const s = mesh(starShape(5, 0.05, 0.022), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      s.position.set(Math.sin(i * 1.7) * 0.15, 0.12 + i * 0.1, 0.2 - i * 0.03);
      g.add(s);
    }
    g.position.y = 0.34;
    onHead(g);
  } else if (id === "outfit-crown") {
    const g = new THREE.Group();
    const gold = mat(0xffc53a, { metalness: 0.6, roughness: 0.3 });
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 24, 1, true), gold));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = mesh(new THREE.ConeGeometry(0.05, 0.14, 8), gold);
      p.position.set(Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2);
      g.add(p);
      const gem = ball(0.025, [0xff4f7a, 0x4fc3ff, 0x6fe08a][i % 3]);
      gem.position.set(Math.cos(a) * 0.215, 0.0, Math.sin(a) * 0.215);
      g.add(gem);
    }
    g.position.y = 0.42;
    onHead(g);
  }
  return out;
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (g) draw(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildDecor(id: string): THREE.Object3D | null {
  const g = new THREE.Group();
  if (id === "decor-rug") {
    const rug = mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.03, 48), mat(0xff9e8a));
    const ring = mesh(new THREE.TorusGeometry(1.2, 0.05, 8, 64), mat(0xfff0d0));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.025;
    rug.receiveShadow = true;
    g.add(rug, ring);
    g.position.set(0, 0.015, 0.2);
  } else if (id === "decor-plant") {
    const pot = mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.5, 20), mat(0xd27047));
    pot.position.y = 0.25;
    g.add(pot);
    for (const [x, y, z, r] of [
      [0, 0.8, 0, 0.32],
      [0.2, 1.05, 0.05, 0.24],
      [-0.18, 1.0, -0.05, 0.26],
      [0.02, 1.3, 0, 0.2],
    ]) {
      const leaf = ball(r, 0x4fae5c);
      leaf.position.set(x, y, z);
      g.add(leaf);
    }
    g.position.set(2.9, 0, -2.3);
  } else if (id === "decor-painting") {
    const frame = mesh(new THREE.BoxGeometry(1.3, 0.95, 0.06), mat(0xb98250));
    const tex = canvasTexture(256, 180, (c) => {
      c.fillStyle = "#9fd8ff";
      c.fillRect(0, 0, 256, 180);
      c.fillStyle = "#ffd34d";
      c.beginPath();
      c.arc(190, 50, 28, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#6cc56f";
      c.beginPath();
      c.ellipse(70, 190, 140, 80, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#4fae5c";
      c.beginPath();
      c.ellipse(220, 200, 120, 70, 0, 0, Math.PI * 2);
      c.fill();
    });
    const pic = mesh(new THREE.PlaneGeometry(1.12, 0.78), new THREE.MeshStandardMaterial({ map: tex }));
    pic.position.z = 0.035;
    g.add(frame, pic);
    g.position.set(1.4, 2.3, -2.96);
  } else if (id === "decor-lamp") {
    const base = mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 20), mat(0x51465e));
    const pole = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 10), mat(0x51465e));
    pole.position.y = 0.8;
    const shade = mesh(
      new THREE.CylinderGeometry(0.22, 0.38, 0.4, 24, 1, true),
      mat(0xfff2c2, { side: THREE.DoubleSide, emissive: 0xffd480, emissiveIntensity: 0.6 }),
    );
    shade.position.y = 1.7;
    const light = new THREE.PointLight(0xffd59a, 6, 5, 1.5);
    light.position.y = 1.6;
    g.add(base, pole, shade, light);
    g.position.set(-3.0, 0, 0.6);
  } else if (id === "decor-toybox") {
    const box = mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), mat(0x5fb6e8));
    box.position.y = 0.275;
    const lid = mesh(new THREE.BoxGeometry(0.95, 0.08, 0.65), mat(0xffcf4d));
    lid.position.set(0, 0.6, -0.12);
    lid.rotation.x = -0.6;
    g.add(box, lid);
    for (const [x, color] of [
      [-0.25, 0xff6f6f],
      [0.05, 0x7ee081],
      [0.28, 0xb48cff],
    ] as const) {
      const block = mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat(color));
      block.position.set(x, 0.62, 0.05);
      block.rotation.y = x * 2;
      g.add(block);
    }
    g.position.set(2.6, 0, -0.6);
    g.rotation.y = -0.5;
  } else if (id === "decor-fishbowl") {
    const table = mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.7, 20), mat(0xc79c6e));
    table.position.y = 0.35;
    const bowl = mesh(
      new THREE.SphereGeometry(0.33, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45, roughness: 0.1 }),
    );
    bowl.position.y = 1.02;
    const fish = ball(0.09, 0xff8a3a, [1.4, 0.9, 0.6]);
    fish.position.set(0, 0.98, 0);
    fish.name = "fish";
    g.add(table, bowl, fish);
    g.position.set(-0.6, 0, -2.5);
  } else if (id === "decor-lights") {
    const colors = [0xffe066, 0xff8fb1, 0x8fd8ff, 0xa6ff9a];
    for (let i = 0; i < 18; i++) {
      const x = -3.4 + i * 0.4;
      const bulb = mesh(
        new THREE.SphereGeometry(0.06, 10, 8),
        new THREE.MeshStandardMaterial({
          color: colors[i % 4],
          emissive: colors[i % 4],
          emissiveIntensity: 1.4,
        }),
      );
      bulb.position.set(x, 3.3 - Math.sin((i % 6) / 5 * Math.PI) * 0.18, -2.9);
      bulb.name = "bulb";
      g.add(bulb);
    }
  } else if (id === "decor-cloudbed") {
    for (const [x, y, z, r] of [
      [0, 0.25, 0, 0.55],
      [0.5, 0.3, 0.1, 0.42],
      [-0.5, 0.3, 0.1, 0.42],
      [0.25, 0.45, -0.3, 0.4],
      [-0.25, 0.45, -0.3, 0.4],
    ]) {
      const puff = ball(r, 0xffffff, [1, 0.6, 1]);
      puff.position.set(x, y, z);
      g.add(puff);
    }
    g.position.set(-2.2, 0, -1.9);
  } else return null;
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
  });
  return g;
}

type Particle = {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  life: number;
  max: number;
  spin: number;
  grow?: number;
};

export class PetScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  private clock = new THREE.Clock();
  private raf = 0;
  private wall!: THREE.MeshStandardMaterial;
  private wallStars: THREE.Texture;
  private sky!: THREE.MeshBasicMaterial;
  private basicBed!: THREE.Object3D;
  private decor = new Map<string, THREE.Object3D>();
  private stand = new THREE.Group();
  private pet: PetParts | null = null;
  private egg: THREE.Group | null = null;
  private eggCracks: THREE.Object3D[] = [];
  private outfit: THREE.Object3D[] = [];
  private view: PetView | null = null;
  private mood: Mood = "happy";
  private props = new THREE.Group();
  private bowl: THREE.Group;
  private toy: THREE.Mesh;
  private particles: Particle[] = [];
  private action: { kind: Action; t: number; dur: number } | null = null;
  private blink = 2;
  private size = 1;
  private targetSize = 1;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private look = new THREE.Vector2();
  onTap: (what: "pet" | "egg") => void = () => {};

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.camera.position.set(0, 2.5, 6);
    this.camera.lookAt(0, 0.95, -0.6);

    this.wallStars = canvasTexture(256, 256, (c) => {
      c.fillStyle = "#2f3768";
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = "#fff4b0";
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) {
        const x = rnd() * 256;
        const y = rnd() * 256;
        c.beginPath();
        c.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
        c.fill();
      }
    });
    this.wallStars.wrapS = this.wallStars.wrapT = THREE.RepeatWrapping;
    this.wallStars.repeat.set(3, 2);

    this.buildRoom();
    this.scene.add(this.stand, this.props);

    this.bowl = new THREE.Group();
    const dish = mesh(new THREE.CylinderGeometry(0.32, 0.24, 0.16, 24), mat(0x4fa3e8));
    dish.position.y = 0.08;
    const food = ball(0.24, 0xc98a4a, [1, 0.35, 1]);
    food.position.y = 0.16;
    food.name = "food";
    this.bowl.add(dish, food);
    this.bowl.position.set(0.1, 0, 1.05);
    this.bowl.visible = false;
    this.props.add(this.bowl);

    this.toy = ball(0.17, 0xff5a5a);
    this.toy.position.set(1.7, 0.17, 0.9);
    const stripe = mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 24), mat(0xffffff));
    this.toy.add(stripe);
    this.props.add(this.toy);

    canvas.addEventListener("pointerdown", this.tap);
    canvas.addEventListener("pointermove", this.move);
    this.loop();
  }

  private buildRoom() {
    const s = this.scene;
    s.background = new THREE.Color(0xf2e4cf);
    s.add(new THREE.HemisphereLight(0xfff6e8, 0xb58a63, 2.0));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
    sun.position.set(3, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -5;
    sun.shadow.camera.right = 5;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    sun.shadow.radius = 4;
    s.add(sun);

    const floorTex = canvasTexture(256, 256, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? "#d9ac7c" : "#d2a271";
        c.fillRect(0, i * 32, 256, 32);
        c.fillStyle = "rgba(120,72,40,0.25)";
        c.fillRect(0, i * 32 + 31, 256, 1);
        c.fillRect(((i * 83) % 200) + 20, i * 32, 1, 32);
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 2);
    const floor = mesh(
      new THREE.PlaneGeometry(7.4, 7),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 0.5;
    floor.receiveShadow = true;
    floor.castShadow = false;
    s.add(floor);

    this.wall = new THREE.MeshStandardMaterial({ color: WALLS[""], roughness: 0.95 });
    const back = mesh(new THREE.PlaneGeometry(7.4, 4.2), this.wall, 0, 2.1, -3);
    const left = mesh(new THREE.PlaneGeometry(7, 4.2), this.wall, -3.7, 2.1, 0.5);
    left.rotation.y = Math.PI / 2;
    const right = mesh(new THREE.PlaneGeometry(7, 4.2), this.wall, 3.7, 2.1, 0.5);
    right.rotation.y = -Math.PI / 2;
    for (const w of [back, left, right]) {
      w.receiveShadow = true;
      w.castShadow = false;
      s.add(w);
    }
    const trim = mat(0xffffff);
    const base = mesh(new THREE.BoxGeometry(7.4, 0.18, 0.06), trim, 0, 0.09, -2.97);
    s.add(base);

    // A window with the sky outside, which follows the player's clock.
    const win = new THREE.Group();
    this.sky = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });
    win.add(mesh(new THREE.PlaneGeometry(1.5, 1.2), this.sky));
    const frame = mat(0xffffff);
    for (const [w, h, x, y] of [
      [1.7, 0.1, 0, 0.65],
      [1.7, 0.1, 0, -0.65],
      [0.1, 1.4, -0.8, 0],
      [0.1, 1.4, 0.8, 0],
      [0.06, 1.2, 0, 0],
      [1.5, 0.06, 0, 0],
    ])
      win.add(mesh(new THREE.BoxGeometry(w, h, 0.08), frame, x, y, 0.02));
    win.position.set(-1.5, 2.3, -2.98);
    s.add(win);
    this.updateSky();

    // The basic bed, which everyone has.
    const bed = new THREE.Group();
    const cushion = mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.22, 32), mat(0xe86b6b));
    cushion.position.y = 0.11;
    const rim = mesh(new THREE.TorusGeometry(0.8, 0.14, 12, 32), mat(0xd85656));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.22;
    bed.add(cushion, rim);
    bed.position.set(-2.2, 0, -1.9);
    this.basicBed = bed;
    s.add(bed);
  }

  private updateSky() {
    const h = new Date().getHours();
    const color =
      h >= 7 && h < 17 ? 0x9fd8ff : h >= 17 && h < 20 ? 0xffb38a : h >= 5 && h < 7 ? 0xffd2a8 : 0x26305e;
    this.sky.color.setHex(color);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // Keep the whole pet and its bed in view on narrow screens.
    this.camera.fov = this.camera.aspect < 1 ? 58 : 42;
    this.camera.position.z = this.camera.aspect < 1 ? 7.5 : 6;
    this.camera.updateProjectionMatrix();
  }

  setPet(view: PetView | null) {
    const same =
      view &&
      this.view &&
      view.species === this.view.species &&
      (view.stage === "egg") === (this.view.stage === "egg");
    if (!same) {
      this.stand.clear();
      this.pet = null;
      this.egg = null;
      this.outfit = [];
      if (view?.stage === "egg") this.buildEgg(view.species);
      else if (view) {
        this.pet = buildPet(view.species);
        this.stand.add(this.pet.root);
      }
    }
    if (this.pet && view && view.outfit !== this.view?.outfit) {
      for (const o of this.outfit) o.parent?.remove(o);
      this.outfit = view.outfit ? buildOutfit(view.outfit, this.pet) : [];
    }
    if (view) {
      this.targetSize = STAGE_SIZE[view.stage];
      if (!same) this.size = this.targetSize;
      // Babies have bigger heads for their size.
      if (this.pet) this.pet.head.scale.setScalar(view.stage === "baby" ? 1.18 : 1);
    }
    this.view = view;
    this.applyFace();
  }

  private buildEgg(species: Species) {
    const g = new THREE.Group();
    const shell = ball(0.55, 0xfff7e8, [0.82, 1, 0.82]);
    shell.position.y = 0.58;
    g.add(shell);
    const spot = PALETTE[species].body;
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const y = 0.25 + (i % 4) * 0.2;
      const r = 0.455 * Math.sqrt(Math.max(0, 1 - ((y - 0.58) / 0.55) ** 2));
      const dot = ball(0.07 + (i % 3) * 0.02, spot, [1, 1, 0.3]);
      dot.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      dot.lookAt(0, y, 0);
      g.add(dot);
    }
    this.eggCracks = [];
    for (let i = 0; i < 4; i++) {
      const crack = mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), mat(0x6b4a3a));
      crack.position.set(-0.18 + i * 0.12, 0.72 + (i % 2 ? 0.05 : -0.05), 0.42);
      crack.rotation.z = i % 2 ? 0.7 : -0.7;
      crack.visible = false;
      g.add(crack);
      this.eggCracks.push(crack);
    }
    g.traverse((o) => (o.userData.egg = true));
    this.egg = g;
    this.stand.add(g);
  }

  setEggTaps(taps: number) {
    this.eggCracks.forEach((c, i) => (c.visible = i < taps));
  }

  setMood(mood: Mood) {
    this.mood = mood;
    this.applyFace();
  }

  private applyFace(forceHappy = false) {
    const p = this.pet;
    if (!p) return;
    const happy = forceHappy || this.mood === "joyful";
    p.eyesOpen.forEach((e) => (e.visible = !happy));
    p.eyesHappy.forEach((e) => (e.visible = happy));
    p.smile.visible = !happy && this.mood !== "sad";
    p.open.visible = happy;
    p.frown.visible = !happy && this.mood === "sad";
    for (const e of p.eyesOpen) e.scale.y = this.mood === "sad" ? 0.75 : 1;
    p.ears.forEach((ear, i) => {
      const side = i ? 1 : -1;
      if (this.view?.species === "puppy") ear.rotation.z = side * (this.mood === "sad" ? 0.15 : 0.35);
    });
  }

  setRoom(room: RoomView) {
    const color = WALLS[room.wallpaper] ?? WALLS[""];
    this.wall.color.setHex(room.wallpaper === "wall-stars" ? 0xffffff : color);
    this.wall.map = room.wallpaper === "wall-stars" ? this.wallStars : null;
    this.wall.needsUpdate = true;
    for (const [id, obj] of this.decor)
      if (!room.decor.includes(id)) {
        this.scene.remove(obj);
        this.decor.delete(id);
      }
    for (const id of room.decor)
      if (!this.decor.has(id)) {
        const obj = buildDecor(id);
        if (obj) {
          this.decor.set(id, obj);
          this.scene.add(obj);
        }
      }
    this.basicBed.visible = !room.decor.includes("decor-cloudbed");
  }

  act(kind: Action) {
    const dur: Partial<Record<Action, number>> = {
      feed: 2.2,
      treat: 1.6,
      play: 2.2,
      bathe: 2.4,
      pet: 1.4,
      wave: 1.3,
      egg: 0.45,
      hatch: 1.4,
      grow: 1.6,
      buy: 1.2,
      left: 0.55,
      right: 0.55,
      jump: 0.55,
      spin: 0.55,
    };
    this.action = { kind, t: 0, dur: dur[kind] ?? 1 };
    if (kind === "feed") this.bowl.visible = true;
    if (kind === "pet") this.burst("heart", 6);
    if (kind === "treat") this.burst("heart", 4);
    if (kind === "hatch" || kind === "grow" || kind === "buy") this.burst("star", 18);
    if (kind === "bathe") this.burst("bubble", 22);
    this.applyFace(kind === "pet" || kind === "treat" || kind === "hatch");
  }

  private burst(kind: "heart" | "star" | "bubble", n: number) {
    const size = this.size;
    for (let i = 0; i < n; i++) {
      let obj: THREE.Object3D;
      if (kind === "bubble") {
        obj = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 + Math.random() * 0.07, 12, 10),
          new THREE.MeshStandardMaterial({
            color: 0xbfe6ff,
            transparent: true,
            opacity: 0.45,
            roughness: 0.05,
            metalness: 0.1,
          }),
        );
      } else {
        obj = new THREE.Mesh(
          kind === "heart" ? heartShape() : starShape(),
          new THREE.MeshBasicMaterial({
            color: kind === "heart" ? 0xff5f8f : [0xffd34d, 0xff9fd0, 0x8fe0ff][i % 3],
            transparent: true,
            side: THREE.DoubleSide,
          }),
        );
        obj.scale.setScalar(kind === "heart" ? 0.28 : 0.22);
      }
      const a = Math.random() * Math.PI * 2;
      const r = kind === "bubble" ? 0.6 * size : 0.3;
      obj.position.set(Math.cos(a) * r, (0.4 + Math.random() * 1.1) * size, Math.sin(a) * r + 0.2);
      const speed = kind === "star" ? 2.2 : 0.8;
      this.particles.push({
        obj,
        vel: new THREE.Vector3(
          Math.cos(a) * speed * 0.6,
          speed * (0.6 + Math.random() * 0.6),
          Math.sin(a) * speed * 0.3,
        ),
        life: 0,
        max: kind === "bubble" ? 1.8 + Math.random() : 1.2 + Math.random() * 0.4,
        spin: (Math.random() - 0.5) * 3,
        grow: kind === "bubble" ? 0.4 : 0,
      });
      this.scene.add(obj);
    }
  }

  private tap = (e: PointerEvent) => {
    const hit = this.hit(e);
    if (hit) this.onTap(hit);
  };
  private move = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.look.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.renderer.domElement.style.cursor = this.hit(e) ? "pointer" : "";
  };
  private hit(e: PointerEvent): "pet" | "egg" | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.stand, true);
    if (!hits.length) return null;
    return hits[0].object.userData.egg ? "egg" : "pet";
  }

  /** Where the pet's head is on screen, in CSS pixels, for speech bubbles. */
  headOnScreen(): { x: number; y: number } {
    const v = new THREE.Vector3(0, (this.view?.stage === "egg" ? 1.3 : 1.75) * this.size, 0.2);
    v.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * rect.width, y: ((1 - v.y) / 2) * rect.height };
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    this.update(dt, this.clock.elapsedTime);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number, time: number) {
    this.size += (this.targetSize - this.size) * Math.min(1, dt * 3);
    this.stand.scale.setScalar(this.size);
    this.stand.position.set(0, 0, 0);
    this.stand.rotation.set(0, 0, 0);
    const a = this.action;
    if (a) a.t += dt;
    const k = a ? Math.min(1, a.t / a.dur) : 0;
    const hop = (n: number, h: number) => Math.abs(Math.sin(k * Math.PI * n)) * h;

    if (this.egg) {
      this.egg.rotation.z =
        a?.kind === "egg" ? Math.sin(k * Math.PI * 4) * 0.25 * (1 - k) : Math.sin(time * 1.5) * 0.04;
      this.egg.position.y = a?.kind === "egg" ? hop(1, 0.12) : 0;
    }

    const p = this.pet;
    if (p) {
      // Idle: breathing, a wagging tail and blinking.
      const breathe = 1 + Math.sin(time * 2.2) * 0.02;
      p.body.scale.set(1, breathe, 1);
      p.tail.rotation.y = Math.sin(time * (this.mood === "sad" ? 2 : 7)) * (this.mood === "sad" ? 0.15 : 0.45);
      for (const [i, w] of p.wings.entries())
        w.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(time * 3) * 0.15);
      this.blink -= dt;
      const closed = this.blink < 0.12;
      if (this.blink < 0) this.blink = 2 + Math.random() * 3;
      for (const e of p.eyesOpen) e.scale.y = closed ? 0.1 : this.mood === "sad" ? 0.75 : 1;
      // Look a little towards the pointer.
      p.head.rotation.y += (this.look.x * 0.35 - p.head.rotation.y) * Math.min(1, dt * 4);
      p.head.rotation.x += (-this.look.y * 0.15 - p.head.rotation.x) * Math.min(1, dt * 4);
      p.head.rotation.z = this.mood === "sad" ? 0.12 : Math.sin(time * 1.3) * 0.04;
      p.body.position.set(0, 0, 0);
      p.body.rotation.set(0, 0, 0);

      if (a) {
        const b = p.body;
        switch (a.kind) {
          case "feed":
            p.head.rotation.x = 0.35 + Math.sin(k * Math.PI * 8) * 0.15;
            b.position.z = 0.2;
            {
              const food = this.bowl.getObjectByName("food");
              if (food) food.scale.set(1 - k * 0.8, 0.35 * (1 - k * 0.8), 1 - k * 0.8);
            }
            break;
          case "treat":
          case "wave":
          case "hatch":
          case "grow":
          case "buy":
            b.position.y = hop(2, 0.45);
            break;
          case "play":
            b.position.y = hop(3, 0.6);
            b.rotation.y = k * Math.PI * 2;
            this.toy.position.set(
              1.7 - Math.sin(k * Math.PI) * 1.7,
              0.17 + hop(3, 1.4),
              0.9 - Math.sin(k * Math.PI) * 0.3,
            );
            break;
          case "bathe":
            b.rotation.z = k > 0.7 ? Math.sin(k * 80) * 0.18 : 0;
            break;
          case "pet":
            b.scale.set(1.05, 0.93 + Math.sin(k * Math.PI * 4) * 0.03, 1.05);
            p.tail.rotation.y = Math.sin(time * 14) * 0.6;
            break;
          case "left":
          case "right":
            b.position.x = Math.sin(k * Math.PI) * (a.kind === "left" ? -0.7 : 0.7);
            b.position.y = hop(1, 0.3);
            b.rotation.z = Math.sin(k * Math.PI) * (a.kind === "left" ? 0.3 : -0.3);
            break;
          case "jump":
            b.position.y = hop(1, 0.9);
            break;
          case "spin":
            b.rotation.y = k * Math.PI * 2;
            b.position.y = hop(1, 0.2);
            break;
        }
        if (a.kind === "hatch") this.stand.scale.setScalar(this.size * Math.min(1, 0.2 + k * 1.6));
      }
    }

    if (a && a.t >= a.dur) {
      this.action = null;
      this.bowl.visible = false;
      this.toy.position.set(1.7, 0.17, 0.9);
      const food = this.bowl.getObjectByName("food");
      food?.scale.set(1, 0.35, 1);
      this.applyFace();
    }

    for (const obj of this.decor.values())
      obj.traverse((o) => {
        if (o.name === "fish") o.position.set(Math.sin(time) * 0.15, 0.98, Math.cos(time) * 0.12), (o.rotation.y = -time);
        if (o.name === "bulb") {
          const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
          m.emissiveIntensity = 0.9 + Math.sin(time * 3 + o.position.x * 2) * 0.6;
        }
      });

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life += dt;
      q.obj.position.addScaledVector(q.vel, dt);
      q.vel.y -= (q.grow ? -0.2 : 1.5) * dt;
      q.obj.rotation.z += q.spin * dt;
      q.obj.quaternion.premultiply(new THREE.Quaternion());
      if (q.grow) q.obj.scale.setScalar(1 + q.life * q.grow);
      const m = (q.obj as THREE.Mesh).material as THREE.Material & { opacity: number };
      m.opacity = Math.max(0, 1 - q.life / q.max) * (q.grow ? 0.45 : 1);
      if (q.life >= q.max) {
        this.scene.remove(q.obj);
        (q.obj as THREE.Mesh).geometry.dispose();
        this.particles.splice(i, 1);
      }
    }
    if (Math.floor(time) % 60 === 0) this.updateSky();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointerdown", this.tap);
    this.renderer.domElement.removeEventListener("pointermove", this.move);
    this.renderer.dispose();
  }
}
