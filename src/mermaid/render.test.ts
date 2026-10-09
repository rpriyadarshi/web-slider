import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { blockToText, mermaidBlocks } from "../model/text";
import { rasterizeMermaid } from "./render";

const source = `
id: diagrams
title: Diagrams
slides:
  - id: flow
    title: Flow
    layout: content
    blocks:
      - type: mermaid
        source: |
          flowchart LR
            A --> B
        caption: Path
`;

describe("mermaid block", () => {
  it("parses and exposes caption text", () => {
    const deck = parseDeck(source);
    const block = deck.slides[0]?.blocks?.[0];
    expect(block?.type).toBe("mermaid");
    expect(block && blockToText(block)).toBe("[Diagram: Path]");
    expect(mermaidBlocks(deck.slides[0]?.blocks)).toHaveLength(1);
  });

  it("refuses rasterization outside the browser", async () => {
    await expect(
      rasterizeMermaid("flowchart LR\n  A --> B", {
        background: "#ffffff",
        surface: "#f4f4f4",
        text: "#111111",
        muted: "#666666",
        accent: "#3db892",
        dark: false,
      }),
    ).rejects.toThrow(/browser/);
  });
});
