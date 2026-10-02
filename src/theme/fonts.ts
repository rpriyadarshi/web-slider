import type { FontName } from "../model/schema";
import interRegular from "../fonts/Inter-Regular.ttf";
import interSemiBold from "../fonts/Inter-SemiBold.ttf";
import sourceSerifRegular from "../fonts/SourceSerif4-Regular.ttf";
import sourceSerifSemiBold from "../fonts/SourceSerif4-Semibold.ttf";
import jetBrainsRegular from "../fonts/JetBrainsMono-Regular.ttf";
import jetBrainsBold from "../fonts/JetBrainsMono-Bold.ttf";

export type FontFiles = Record<FontName, { regular: Uint8Array; semibold: Uint8Array }>;

const FONT_URLS: Record<FontName, { regular: string; semibold: string }> = {
  Inter: { regular: interRegular, semibold: interSemiBold },
  "Source Serif 4": { regular: sourceSerifRegular, semibold: sourceSerifSemiBold },
  "JetBrains Mono": { regular: jetBrainsRegular, semibold: jetBrainsBold },
};

let pending: Promise<FontFiles> | null = null;

async function readFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Font failed to load (${response.status}).`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export function loadFontFiles(): Promise<FontFiles> {
  if (!pending) {
    pending = Promise.all(
      (Object.keys(FONT_URLS) as FontName[]).map(async (name) => {
        const files = FONT_URLS[name];
        const [regular, semibold] = await Promise.all([readFont(files.regular), readFont(files.semibold)]);
        return [name, { regular, semibold }] as const;
      }),
    ).then((entries) => Object.fromEntries(entries) as FontFiles);
  }
  return pending;
}
