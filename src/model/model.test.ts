import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseManifest, presentTalk, resolveManifest, sourceHash } from "./install";
import { parseDeck } from "./parse";
import { DEFAULT_THEME, resolveTheme } from "./schema";
import { serializeDeck } from "./serialize";
import { formatSessionBlock, normalizeSession, PANE, sessionFromDeck } from "./session";
import { blockToText } from "./text";
import { jumpToVisibleNumber, moveBack, moveForward, revealThresholds, visibleNumber } from "./steps";

const sample = readFileSync(new URL("../../samples/examples/launch-review.yaml", import.meta.url), "utf8");
const northwind = readFileSync(new URL("../../samples/examples/northwind/manifest.yaml", import.meta.url), "utf8");

const validDeck = `
id: review
title: Review
author: Ada
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
  it("parses the bundled sample and round-trips it", async () => {
    const deck = parseDeck(sample);
    expect(deck.slides.map((slide) => slide.layout)).toEqual([
      "title",
      "section",
      "content",
      "quote",
      "content",
      "content",
      "content",
      "content",
    ]);
    expect(deck.footer).toBe("Launch Review");
    expect(deck.slides.at(-1)?.hidden).toBe(true);
    expect(deck.slides.some((slide) => slide.widgets?.some((widget) => widget.type === "scale"))).toBe(true);
    expect(deck.slides.some((slide) => slide.side?.some((block) => block.type === "code"))).toBe(true);
    expect(sample).not.toContain("Keep taken notes on the deck");
    expect(sample).toContain("Keep taken notes in the session");
    expect(deck.brand).toBeUndefined();
    expect(deck.theme).toBeUndefined();
    const manifest = resolveManifest(parseManifest(northwind), await sourceHash(northwind));
    const presented = presentTalk(deck, manifest);
    expect(presented.brand).toBe("emporion");
    expect(presented.theme?.type?.mark).toBe(22);
    expect(presented.theme?.type?.wordmark).toBe(12);
    expect(resolveTheme(presented.theme).type.title).toBe(58);
    expect(presented.theme?.chrome).toBe("dark");
    expect(presented.theme?.chromeDark?.ground).toBe("#121212");
    expect(resolveTheme(presented.theme, deck.slides.find((slide) => slide.id === "date")?.theme).accent).toBe("#8eb6ff");
    expect(resolveTheme({ type: { mark: 40 } }).type).toMatchObject({ mark: 40, wordmark: 12, title: 58 });
    const again = parseDeck(serializeDeck(deck, sessionFromDeck(deck)));
    expect(again).toEqual(deck);
    const exported = serializeDeck(presented, sessionFromDeck(deck));
    expect(exported).not.toContain("brand:");
    expect(parseDeck(exported).theme).toBeUndefined();
    expect(parseDeck(exported).slides.find((slide) => slide.id === "date")?.theme?.accent).toBe("#8eb6ff");
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

  it("rejects a brand or theme copied into the talk", () => {
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

describe("session panes", () => {
  it("keeps an older session and fills pane sizes that were never stored", () => {
    const deck = parseDeck(validDeck);
    const restored = normalizeSession(deck, {
      slideIndex: 0,
      revealed: 0,
      answers: {},
      notes: {},
      ui: { toc: true, side: false, bottom: true, theme: "dark" },
    });
    expect(restored.ui.tocWidth).toBe(PANE.tocWidth);
    expect(restored.ui.bottomHeight).toBe(PANE.bottomHeight);
    expect(restored.ui.decisionsWidth).toBe(PANE.decisionsWidth);
    expect(restored.ui.notesWidth).toBe(PANE.notesWidth);
  });

  it("widens notes that are still at the old default", () => {
    const deck = parseDeck(validDeck);
    const restored = normalizeSession(deck, {
      slideIndex: 0,
      revealed: 0,
      answers: {},
      notes: {},
      ui: { toc: true, side: false, bottom: true, theme: "dark", notesWidth: 320 },
    });
    expect(restored.ui.notesWidth).toBe(PANE.notesWidth);
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

  it("formats the current slide session as its own record", () => {
    const text = formatSessionBlock("scope", "They said yes.", { ship: "Yes", risks: ["Date"] });
    expect(text).toContain("slide: scope");
    expect(text).toContain("takenNotes: They said yes.");
    expect(text).toContain("ship: 'Yes'");
    expect(text).toContain("Date");
    expect(formatSessionBlock("scope", "", {})).toContain("answers: {}");
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

  it("skips hidden slides and jumps by the visible slide number", () => {
    const deck = parseDeck(`
id: review
title: Review
slides:
  - id: a
    title: A
    layout: content
  - id: b
    title: B
    hidden: true
    layout: content
  - id: c
    title: C
    layout: content
    blocks:
      - type: numbered
        items:
          - text: One
            step: 1
`);
    expect(moveForward(deck, 0, 0)).toEqual({ slideIndex: 2, revealed: 0 });
    expect(moveBack(deck, 2, 0).slideIndex).toBe(0);
    expect(jumpToVisibleNumber(deck, 2)?.slideIndex).toBe(2);
    expect(jumpToVisibleNumber(deck, 3)).toBeNull();
    expect(visibleNumber(deck, 2)).toBe(2);
    expect(visibleNumber(deck, 1)).toBeNull();
    const numbered = deck.slides[2]?.blocks?.[0];
    expect(numbered && blockToText(numbered)).toBe("1. One");
  });
});
