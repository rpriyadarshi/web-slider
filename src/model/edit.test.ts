import { describe, expect, it } from "vitest";
import { replaceListItem, replaceSlideTitle } from "./edit";
import { parseDeck } from "./parse";
import { serializeDeck } from "./serialize";
import { sessionFromDeck } from "./session";

const source = `
id: review
title: Review
slides:
  - id: scope
    title: Scope
    layout: content
    blocks:
      - type: bullets
        items:
          - text: First
          - text: Second
`;

describe("slide edits", () => {
  it("writes a title and a bullet back into the YAML", () => {
    const deck = parseDeck(source);
    const session = sessionFromDeck(deck);
    const titled = replaceSlideTitle(deck, "scope", "Scope is the constraint");
    const edited = replaceListItem(titled, "scope", 0, 1, "Keep the notes");
    const yaml = serializeDeck(edited, session);
    const again = parseDeck(yaml);
    expect(again.slides[0]?.title).toBe("Scope is the constraint");
    const bullets = again.slides[0]?.blocks?.[0];
    expect(bullets?.type === "bullets" && bullets.items[1]?.text).toBe("Keep the notes");
  });

  it("rejects an empty title and an empty list item", () => {
    const deck = parseDeck(source);
    expect(() => replaceSlideTitle(deck, "scope", "  ")).toThrow(/empty/);
    expect(() => replaceListItem(deck, "scope", 0, 0, "")).toThrow(/empty/);
  });
});
