import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "./parse";
import { DEFAULT_THEME, resolveTheme } from "./schema";
import { serializeDeck } from "./serialize";
import { sessionFromDeck } from "./session";
import { moveBack, moveForward, revealThresholds } from "./steps";

const sample = readFileSync(new URL("../sample/deck.yaml", import.meta.url), "utf8");

const validDeck = `
id: review
title: Review
author: Ada
theme:
  fontHeading: Source Serif 4
  align: left
slides:
  - id: open
    title: Open
    layout: title
    subtitle: A short review
  - id: scope
    title: Scope
    layout: content
    notes: Stay on the decision.
    blocks:
      - type: paragraph
        text: Hold the line.
      - type: bullets
        items:
          - text: First
            step: 1
          - text: Second
            step: 2
    side:
      - type: code
        language: yaml
        code: |
          id: scope
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
      - id: risks
        type: checkbox
        prompt: Risks
        options: [Date, Staff]
`;

describe("parseDeck", () => {
  it("parses the bundled sample and round-trips it", () => {
    const deck = parseDeck(sample);
    expect(deck.slides.map((slide) => slide.layout)).toEqual(["title", "section", "content", "quote", "content"]);
    expect(deck.slides.some((slide) => slide.widgets?.some((widget) => widget.type === "scale"))).toBe(true);
    expect(deck.slides.some((slide) => slide.side?.some((block) => block.type === "code"))).toBe(true);
    expect(deck.brand).toMatchObject({ wordmark: "EMPORION", tail: "AI", accent: "#3DB892" });
    expect(deck.theme?.chrome).toBe("dark");
    expect(deck.theme?.chromeDark?.ground).toBe("#121212");
    const again = parseDeck(serializeDeck(deck, sessionFromDeck(deck)));
    expect(again).toEqual(deck);
  });

  it("rejects an empty file, a non-mapping, unknown keys, bad image paths, and duplicate ids", () => {
    expect(() => parseDeck("   ")).toThrow(/empty/);
    expect(() => parseDeck("- just a list")).toThrow(/YAML mapping/);
    expect(() => parseDeck("id: a\ntitle: T\nslides: []\ntheme:\n  animation: spin\n")).toThrow(/animation|unrecognized|Unrecognized/);
    expect(() =>
      parseDeck(`
id: a
title: T
slides:
  - id: one
    title: One
    layout: content
    blocks:
      - type: image
        src: ../local.png
`),
    ).toThrow(/package path|cannot be read/);
    expect(() =>
      parseDeck(`
id: a
title: T
slides:
  - id: one
    title: One
    layout: content
  - id: one
    title: Again
    layout: content
`),
    ).toThrow(/duplicate slide id/);
  });

  it("rejects an unknown brand id", () => {
    expect(() =>
      parseDeck(`
id: a
title: T
brand: other
slides:
  - id: one
    title: One
    layout: content
`),
    ).toThrow(/brand|invalid|Invalid/);
  });

  it("rejects widget answers that are not in the options", () => {
    expect(() =>
      parseDeck(`
id: a
title: T
slides:
  - id: one
    title: One
    layout: content
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
        answer: Maybe
`),
    ).toThrow(/answer is not one of the options/);
  });

  it("applies theme defaults only after a valid parse", () => {
    const deck = parseDeck(validDeck);
    expect(deck.theme?.background).toBeUndefined();
    expect(resolveTheme(deck.theme).background).toBe(DEFAULT_THEME.background);
    expect(resolveTheme(deck.theme).fontHeading).toBe("Source Serif 4");
  });
});

describe("session merge", () => {
  it("round-trips answers and taken notes through YAML", () => {
    const deck = parseDeck(validDeck);
    const session = sessionFromDeck(deck);
    session.answers.scope = { ship: "Yes", risks: ["Date"] };
    session.notes.scope = "Asked who owns the date.";

    const exported = serializeDeck(deck, session);
    const again = parseDeck(exported);
    const restored = sessionFromDeck(again);

    expect(restored.answers.scope).toEqual({ ship: "Yes", risks: ["Date"] });
    expect(restored.notes.scope).toBe("Asked who owns the date.");
    expect(again.slides[0]?.takenNotes).toBeUndefined();
    expect(again.theme?.background).toBeUndefined();
  });
});

describe("steps", () => {
  it("advances through builds before changing slides, and returns to a finished slide", () => {
    const deck = parseDeck(validDeck);
    expect(revealThresholds(deck.slides[1])).toEqual([0, 1, 2]);

    const first = moveForward(deck, 1, 0);
    expect(first).toEqual({ slideIndex: 1, revealed: 1 });
    const second = moveForward(deck, first.slideIndex, first.revealed);
    expect(second).toEqual({ slideIndex: 1, revealed: 2 });
    const next = moveForward(deck, second.slideIndex, second.revealed);
    expect(next).toEqual({ slideIndex: 1, revealed: 2 });

    const back = moveBack(deck, 1, 0);
    expect(back.slideIndex).toBe(0);
    expect(back.revealed).toBe(0);
  });
});
