import type { BrandInput } from "../model/schema";

export const CHROME = {
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
  wordmark: string;
  tail?: string;
  accent: string;
  highlight: string;
  markLight: string;
  markDark: string;
};

export function resolveBrand(brand: BrandInput | undefined): ResolvedBrand | null {
  if (!brand) return null;
  if (typeof brand === "string") {
    throw new Error(
      `Brand "${brand}" is a package name and was not loaded. A missing package is not replaced with another brand.`,
    );
  }
  return {
    wordmark: brand.wordmark,
    tail: brand.tail,
    accent: brand.accent,
    highlight: brand.highlight,
    markLight: brand.mark,
    markDark: brand.markDark ?? brand.mark,
  };
}

export function resolveChrome(
  theme: { accent?: string; highlight?: string; chromeLight?: ChromeColors; chromeDark?: ChromeColors } | undefined,
  mode: ChromeMode,
  brand: ResolvedBrand | null,
) {
  const base = CHROME[mode];
  const override = mode === "light" ? theme?.chromeLight : theme?.chromeDark;
  const accent = brand?.accent ?? theme?.accent;
  const highlight = brand?.highlight ?? theme?.highlight;
  if (!accent || !highlight) {
    throw new Error("The theme has no accent or highlight. Set them on the brand or the theme.");
  }
  return {
    ground: override?.ground ?? base.ground,
    paper: override?.paper ?? base.paper,
    text: override?.text ?? base.text,
    muted: override?.muted ?? base.muted,
    line: override?.line ?? base.line,
    accent,
    highlight,
  };
}

type ChromeColors = {
  ground?: string;
  paper?: string;
  text?: string;
  muted?: string;
  line?: string;
};

export function withAssetUrls(brand: ResolvedBrand | null, assets?: Map<string, string>): ResolvedBrand | null {
  if (!brand) return null;
  return {
    ...brand,
    markLight: assets?.get(brand.markLight) ?? brand.markLight,
    markDark: assets?.get(brand.markDark) ?? brand.markDark,
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
