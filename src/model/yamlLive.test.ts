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

describe("YAML path edits", () => {
  it("sets a field and keeps the rest of the file, including comments", () => {
    const titled = writeYamlIn(source, ["slides", 0, "title"], "Scope is the constraint");
    const withFooter = writeYamlIn(titled, ["footer"], "Launch Review");
    expect(withFooter).toContain("# keep");
    expect(withFooter).toContain("notes: Say this.");
    const deck = parseDeck(withFooter);
    expect(deck.slides[0]?.title).toBe("Scope is the constraint");
    expect(deck.footer).toBe("Launch Review");
  });

  it("removes a field when the value is cleared", () => {
    const written = writeYamlIn(source, ["footer"], "Launch Review");
    const cleared = writeYamlIn(written, ["footer"], "");
    expect(cleared).not.toContain("footer");
    expect(parseDeck(cleared).footer).toBeUndefined();
  });
});
