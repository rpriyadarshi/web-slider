import { describe, expect, it } from "vitest";
import { caretSelection, locateProbe, probeAt, probeKey } from "./probe";

const source = `id: review
title: Review
footer: Hello
slides:
  - id: scope
    title: Scope
    blocks:
      - type: bullets
        items:
          - text: First
          - text: Second
`;

describe("YAML cross-probe", () => {
  it("finds a slide title and a bullet from a path", () => {
    const title = locateProbe(source, ["slides", 0, "title"]);
    expect(title && source.slice(title.start, title.end)).toContain("title: Scope");
    const bullet = locateProbe(source, ["slides", 0, "blocks", 0, "items", 1]);
    expect(bullet && source.slice(bullet.start, bullet.end)).toContain("Second");
    const list = locateProbe(source, ["slides", 0, "blocks", 0]);
    const listText = list ? source.slice(list.start, list.end) : "";
    expect(listText).toContain("First");
    expect(listText).toContain("Second");
  });

  it("resolves the caret to the deepest node", () => {
    const offset = source.indexOf("text: Second");
    expect(probeKey(probeAt(source, offset + 2) ?? [])).toBe("slides/0/blocks/0/items/1/text");
  });

  it("selects the full title string, not the first line only", () => {
    const titled = `id: review
title: Review
slides:
  - id: scope
    title: This title is long enough
      to wrap onto a second line
    layout: content
`;
    const offset = titled.indexOf("second line");
    const range = caretSelection(titled, offset);
    expect(range).not.toBeNull();
    const text = titled.slice(range?.start, range?.end);
    expect(text).toContain("This title is long enough");
    expect(text).toContain("to wrap onto a second line");
    const firstLineEnd = titled.indexOf("\n", titled.indexOf("This title is long enough"));
    expect(range && range.end).toBeGreaterThan(firstLineEnd);
  });

  it("selects the whole widget when the caret is inside one field", () => {
    const deck = `id: review
title: Review
slides:
  - id: scope
    title: Scope
    layout: content
    widgets:
      - id: ship
        type: radio
        prompt: Which way?
        options:
          - Yes
          - No
`;
    const offset = deck.indexOf("- Yes");
    const range = caretSelection(deck, offset + 2);
    expect(range).not.toBeNull();
    const text = deck.slice(range?.start, range?.end);
    expect(text).toContain("id: ship");
    expect(text).toContain("prompt: Which way?");
    expect(text).toContain("Yes");
    expect(text).toContain("No");
    expect(probeKey(range?.path ?? [])).toBe("slides/0/widgets/0");
    const yesLineEnd = deck.indexOf("\n", deck.indexOf("- Yes"));
    expect(range && range.end).toBeGreaterThan(yesLineEnd);
  });
});
