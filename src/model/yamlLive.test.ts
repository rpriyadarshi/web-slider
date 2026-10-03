import { describe, expect, it } from "vitest";
import { parseDeck } from "./parse";
import { writeYamlIn } from "./yamlLive";

const source = `# keep
id: review
title: Review
slides:
  - id: scope
    title: Scope
    layout: content
    notes: Say this.
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
`;

describe("live YAML fields", () => {
  it("writes taken notes and a widget answer without dropping the rest of the file", () => {
    const withNotes = writeYamlIn(source, ["slides", 0, "takenNotes"], "They said yes.");
    const withAnswer = writeYamlIn(withNotes, ["slides", 0, "widgets", 0, "answer"], "Yes");
    expect(withAnswer).toContain("# keep");
    expect(withAnswer).toContain("notes: Say this.");
    const deck = parseDeck(withAnswer);
    expect(deck.slides[0]?.takenNotes).toBe("They said yes.");
    expect(deck.slides[0]?.widgets?.[0]?.answer).toBe("Yes");
  });

  it("removes taken notes when the field is cleared", () => {
    const written = writeYamlIn(source, ["slides", 0, "takenNotes"], "Note");
    const cleared = writeYamlIn(written, ["slides", 0, "takenNotes"], "");
    expect(cleared).not.toContain("takenNotes");
    expect(parseDeck(cleared).slides[0]?.takenNotes).toBeUndefined();
  });
});
