import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { LANGUAGES, PACKS, translate } from "../src/i18n";

const manifest = JSON.parse(readFileSync("game.json", "utf8"));
const zh = PACKS["zh-CN"];
const placeholders = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort();
// Han characters: Chinese text. Japanese packs may use kanji, so they are
// checked against the exact Chinese strings instead.
const HAN = /\p{Script=Han}/u;
// Japanese written the same as the Chinese, on purpose.
const SAME_IN_JAPANESE = new Set(["In use"]);

test("there is one pack file per language other than English", () => {
  const files = readdirSync("src/locales")
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .sort();
  assert.deepEqual(files, Object.keys(PACKS).sort());
});

test("every pack has exactly the Chinese pack's keys and placeholders", () => {
  for (const [lang, pack] of Object.entries(PACKS)) {
    assert.deepEqual(Object.keys(pack).sort(), Object.keys(zh).sort(), lang);
    for (const [key, value] of Object.entries(pack)) {
      assert.ok(value.trim(), `${lang}: "${key}" is empty`);
      assert.deepEqual(placeholders(value), placeholders(key), `${lang}: "${key}"`);
    }
  }
});

test("every UI string and shop item has a translation in every pack", () => {
  const wanted = new Set<string>(manifest.shop.map((i: { title: { en: string } }) => i.title.en));
  for (const file of readdirSync("src").filter((f) => f.endsWith(".tsx"))) {
    const src = readFileSync(`src/${file}`, "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) wanted.add(m[1]);
  }
  const missing: string[] = [];
  for (const [lang, pack] of Object.entries(PACKS))
    for (const key of wanted) if (!pack[key]) missing.push(`${lang}: ${key}`);
  assert.deepEqual(missing, []);
});

test("the Chinese shop names match game.json", () => {
  for (const item of manifest.shop) assert.equal(zh[item.title.en], item.title.zh, item.id);
});

test("game.json lists every language, with a title and description in each", () => {
  assert.deepEqual([...manifest.languages].sort(), [...LANGUAGES].sort());
  assert.ok(manifest.languages.includes("en"));
  for (const lang of manifest.languages) {
    const field = lang === "zh-CN" ? "zh" : lang;
    assert.ok(manifest.title[field]?.trim(), `title.${field}`);
    assert.ok(manifest.description[field]?.trim(), `description.${field}`);
    assert.ok(manifest.description[field].length <= 300, `description.${field} is too long`);
  }
});

test("translate gives each language its own text", () => {
  assert.equal(translate("Feed", "zh-CN"), "喂食");
  assert.equal(translate("Feed", "es"), "Dar de comer");
  assert.equal(translate("Feed", "pt-BR"), "Alimentar");
  assert.equal(translate("Feed", "id"), "Beri makan");
  assert.equal(translate("Feed", "ja"), "ごはん");
  assert.equal(translate("Feed", "ko"), "밥 주기");
  assert.equal(translate("Golden crown", "es"), "Corona dorada");
  // Patterns carry numbers and names.
  assert.equal(translate("Caught 12", "es"), "Atrapadas: 12");
  assert.equal(translate("Daily visit: +7 coins (3-day streak)", "pt-BR"), "Visita diária: +7 moedas (3 dias seguidos)");
  assert.equal(translate("Box 2", "ko"), "2번 상자");
});

test("English and unknown languages get English, never Chinese", () => {
  for (const locale of ["en", "fr", "de", "zh", "", "constructor", "__proto__"]) {
    assert.equal(translate("Feed", locale), "Feed", locale);
    assert.equal(translate("Caught 12", locale), "Caught 12", locale);
  }
  assert.equal(translate("toString", "es"), "toString");
  assert.equal(translate("Not a string Pawpal knows", "ja"), "Not a string Pawpal knows");
});

test("no pack other than Chinese holds Chinese text", () => {
  const zhValues = new Set(Object.values(zh));
  for (const [lang, pack] of Object.entries(PACKS)) {
    if (lang === "zh-CN") continue;
    for (const [key, value] of Object.entries(pack)) {
      if (!(lang === "ja" && SAME_IN_JAPANESE.has(key)))
        assert.ok(!zhValues.has(value), `${lang}: "${key}" is the Chinese text`);
      if (lang !== "ja") assert.ok(!HAN.test(value), `${lang}: "${key}" has Chinese characters`);
    }
    for (const key of Object.keys(zh))
      assert.ok(lang === "ja" || !HAN.test(translate(key, lang)), `${lang}: ${key}`);
  }
});
