import type { BrandInput } from "../model/schema";
import favicon from "./emporion/favicon.svg";
import markDark from "./emporion/mark-on-dark.svg";
import markLight from "./emporion/mark.svg";

export const EMPORION_FAVICON = favicon;

export const CHROME = {
  emerald: "#3DB892",
  citrine: "#E4B84A",
  light: {
    ground: "#FAFAFA",
    paper: "#FFFFFF",
    text: "#1F1F1F",
    muted: "#5E5E5E",
    line: "#E0E0E0",
  },
  dark: {
    ground: "#121212",
    paper: "#1E1E1E",
    text: "#E8E8E8",
    muted: "#A6A6A6",
    line: "#333333",
  },
} as const;

export type ChromeMode = "light" | "dark";

export type ResolvedBrand = {
  id: "emporion" | "custom";
  wordmark: string;
  tail?: string;
  accent: string;
  highlight: string;
  markLight: string;
  markDark: string;
};

export function resolveBrand(brand: BrandInput | undefined): ResolvedBrand | null {
  if (!brand) return null;
  if (brand === "emporion") {
    return {
      id: "emporion",
      wordmark: "EMPORION",
      tail: "AI",
      accent: CHROME.emerald,
      highlight: CHROME.citrine,
      markLight,
      markDark,
    };
  }
  return {
    id: "custom",
    wordmark: brand.wordmark,
    accent: brand.accent,
    highlight: brand.highlight,
    markLight: brand.mark,
    markDark: brand.mark,
  };
}

export function BrandLockup({ brand, mode }: { brand: ResolvedBrand; mode: ChromeMode }) {
  const mark = mode === "dark" ? brand.markDark : brand.markLight;
  return (
    <span className="lockup">
      <img src={mark} alt="" width={28} height={28} />
      <span className="wordmark">
        {brand.wordmark}
        {brand.tail ? <i> {brand.tail}</i> : null}
      </span>
    </span>
  );
}
