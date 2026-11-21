// The game's link to dingn: the SDK connection, shared through React context,
// plus the translations Pawpal needs. The language can change while playing
// (dingn.onLanguage), so it lives in state and everything re-renders in it.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { DingnGame, Locale } from "../sdk/dingn-sdk.js";
import { translate } from "./i18n";

const DingnContext = createContext<DingnGame | null>(null);

export function DingnProvider({
  sdk,
  children,
}: {
  sdk: DingnGame;
  children: ReactNode;
}) {
  // Re-render when the player signs in or out, or switches language.
  const [player, setPlayer] = useState(sdk.player);
  const [locale, setLocale] = useState<Locale>(sdk.locale);
  useEffect(() => sdk.onPlayer(setPlayer), [sdk]);
  // Old dingn builds have no onLanguage.
  useEffect(() => sdk.onLanguage?.(setLocale), [sdk]);
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);
  return (
    <DingnContext.Provider value={{ ...sdk, player, locale }}>
      {children}
    </DingnContext.Provider>
  );
}

export function useDingn() {
  const sdk = useContext(DingnContext);
  if (!sdk) throw new Error("DingnProvider missing");
  return sdk;
}

/** Translates `text`, then fills {0}, {1}... with `args`. */
export type Translate = (text: string, ...args: (string | number)[]) => string;

export function useLocale(): { locale: Locale; t: Translate } {
  const { locale } = useDingn();
  return {
    locale,
    t: (text, ...args) =>
      translate(text, locale).replace(/\{(\d+)\}/g, (m, n) =>
        Number(n) < args.length ? String(args[Number(n)]) : m,
      ),
  };
}
