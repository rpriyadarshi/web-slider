import type { Block } from "../model/schema";
import type { RasterImage } from "../export/images";
import { isDarkHex } from "../highlight";
import type { ResolvedTheme } from "../model/schema";
import { rasterizeMermaid } from "./render";

export function mermaidFallbackText(block: Extract<Block, { type: "mermaid" }>): string {
  const source = block.source.replace(/\s+$/, "");
  return block.caption ? `${block.caption}\n\n${source}` : source;
}

export async function mermaidRasterOrNull(
  block: Extract<Block, { type: "mermaid" }>,
  theme: ResolvedTheme,
): Promise<RasterImage | null> {
  if (typeof document === "undefined") return null;
  return rasterizeMermaid(block.source, {
    background: theme.background,
    surface: theme.surface,
    text: theme.text,
    muted: theme.muted,
    accent: theme.accent,
    dark: isDarkHex(theme.background),
  });
}
