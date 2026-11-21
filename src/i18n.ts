// Pawpal's language packs, one per language other than English: each maps the
// English text the code passes to t() to its translation. The same rules as
// the website's translations: exact strings first, then patterns such as
// "Level {0}", longest literal first. English, an unknown language or a
// missing string falls back to the English text, never another language.
import zhCN from "./locales/zh-CN.json";
import es from "./locales/es.json";
import ptBR from "./locales/pt-BR.json";
import id from "./locales/id.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import type { Locale } from "../sdk/dingn-sdk.js";

export const PACKS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "zh-CN": zhCN,
  es,
  "pt-BR": ptBR,
  id,
  ja,
  ko,
};
/** Every language Pawpal speaks, as listed in game.json's `languages`. */
export const LANGUAGES: Locale[] = ["en", ...Object.keys(PACKS)];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
type Pattern = { re: RegExp; value: string };
const compiled = new Map<string, Pattern[]>();
function patternsOf(locale: string, pack: Readonly<Record<string, string>>) {
  let list = compiled.get(locale);
  if (!list) {
    list = Object.entries(pack)
      .filter(([key]) => /\{\d+\}/.test(key))
      .sort(
        ([a], [b]) =>
          b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length,
      )
      .map(([key, value]) => ({
        re: new RegExp(
          "^" +
            key
              .split(/\{\d+\}/)
              .map(escape)
              .join("(.*?)") +
            "$",
        ),
        value,
      }));
    compiled.set(locale, list);
  }
  return list;
}

export function translate(text: string, locale: Locale): string {
  if (locale === "en" || !text || !Object.hasOwn(PACKS, locale)) return text;
  const pack = PACKS[locale];
  const key = text.replace(/\s+/g, " ").trim();
  if (Object.hasOwn(pack, key) && pack[key]) return pack[key];
  for (const { re, value } of patternsOf(locale, pack)) {
    const match = key.match(re);
    if (match)
      return value.replace(/\{(\d+)\}/g, (_, n) => match[Number(n) + 1] ?? "");
  }
  return text;
}
