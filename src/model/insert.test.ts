import { describe, expect, it } from "vitest";
import { blankDeckSource } from "./blank";
import { BLOCK_KINDS, editParsed, freshId, insertBlock, insertSlide, insertWidget, removeNode, removeParsed, WIDGET_KINDS } from "./insert";
import { parseDeck } from "./parse";

const source = `# keep
id: review
title: Review
slides:
  - id: scope
    title: Scope
    layout: content
    notes: Say this.
    blocks:
      - type: paragraph
        text: Hello # stay
    widgets:
      - id: radio
        type: radio
        prompt: Ship?
        options: [Yes, No]
  - id: next
    title: Next
    layout: content
`;

describe("YAML insert and remove", () => {
  it("opens a blank deck as one content slide and nothing else", () => {
    const yaml = blankDeckSource();
    expect(yaml).not.toMatch(/^brand:/m);
    expect(yaml).not.toMatch(/^theme:/m);
    expect(yaml).not.toMatch(/^fonts:/m);
    const deck = parseDeck(yaml);
    expect(deck.brand).toBeUndefined();
    expect(deck.theme).toBeUndefined();
    expect(deck.fonts).toBeUndefined();
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]?.layout).toBe("content");
    expect(deck.slides[0]?.title).toBe("Untitled");
    expect(deck.id).toBe("deck");
  });

  it("inserts a slide after the caret slide and keeps comments", () => {
    const inserted = insertSlide(source, 0);
    expect(inserted.yaml).toContain("# keep");
    expect(inserted.yaml).toContain("Hello # stay");
    const deck = parseDeck(inserted.yaml);
    expect(deck.slides.map((slide) => slide.id)).toEqual(["scope", "slide", "next"]);
    expect(deck.slides[1]?.layout).toBe("content");
    expect(deck.slides[1]?.title).toBe("Untitled");
    expect(inserted.path).toEqual(["slides", 1]);
  });

  it("gives slides and widgets ids that are not already in the deck", () => {
    const used = new Set(["slide", "slide-2", "radio"]);
    expect(freshId(used, "slide")).toBe("slide-3");
    expect(freshId(used, "text")).toBe("text");
    const first = insertWidget(source, 1, "radio");
    const second = insertWidget(first.yaml, 1, "radio");
    const deck = parseDeck(second.yaml);
    const ids = deck.slides.flatMap((slide) => [slide.id, ...(slide.widgets ?? []).map((widget) => widget.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    const added = deck.slides[1]?.widgets ?? [];
    expect(added).toHaveLength(2);
    expect(added[0]?.id).not.toBe(added[1]?.id);
    expect(added[0]?.id).not.toBe("radio");
    expect(added.every((widget) => widget.answer === undefined)).toBe(true);
    expect(added[0]?.type === "radio" && added[0].options).toEqual(["Yes", "No"]);
  });

  it("inserts each block and widget kind so the deck still parses", () => {
    let yaml = source;
    for (const type of BLOCK_KINDS) yaml = insertBlock(yaml, 0, "blocks", type).yaml;
    yaml = insertBlock(yaml, 0, "side", "paragraph").yaml;
    for (const type of WIDGET_KINDS) yaml = insertWidget(yaml, 0, type).yaml;
    const deck = parseDeck(yaml);
    expect(deck.slides[0]?.blocks?.map((block) => block.type)).toEqual(["paragraph", ...BLOCK_KINDS]);
    expect(deck.slides[0]?.side?.[0]?.type).toBe("paragraph");
    const widgets = deck.slides[0]?.widgets ?? [];
    expect(widgets.map((widget) => widget.type)).toEqual(["radio", ...WIDGET_KINDS]);
    for (const widget of widgets) expect(widget.answer).toBeUndefined();
    expect(yaml).toContain("# keep");
    expect(yaml).toContain("Hello # stay");
  });

  it("removes a widget or a block and refuses the last slide", () => {
    const removedWidget = removeNode(source, ["slides", 0, "widgets", 0]);
    expect(parseDeck(removedWidget).slides[0]?.widgets ?? []).toEqual([]);
    expect(removedWidget).toContain("# keep");
    const removedBlock = removeNode(source, ["slides", 0, "blocks", 0]);
    expect(parseDeck(removedBlock).slides[0]?.blocks ?? []).toEqual([]);
    expect(removedBlock).not.toContain("Hello");
    const removedSlide = removeNode(source, ["slides", 0]);
    expect(parseDeck(removedSlide).slides.map((slide) => slide.id)).toEqual(["next"]);
    const only = blankDeckSource();
    expect(() => removeNode(only, ["slides", 0])).toThrow(/last slide/);
    expect(removeParsed(source, true, ["slides", 0, "widgets", 0])).toBeNull();
    expect(editParsed("id: [", false, (text) => insertWidget(text, 0, "text"))).toBeNull();
    expect(editParsed(source, true, (text) => insertWidget(text, 0, "text"))).toBeNull();
  });
});
