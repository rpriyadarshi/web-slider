import { describe, expect, it } from "vitest";
import { completeTheme, parseManifest } from "./install";
import { insertSlide } from "./insert";
import { parseDeck } from "./parse";
import { themeSchema } from "./schema";
import {
  boxesOverlap,
  DEFAULT_LAYOUTS,
  layoutNames,
  REGION_SCALE_MIN,
  regionScale,
  resolveLayouts,
  slideRegions,
} from "./regions";

const talk = `
id: deck
title: Talk
slides:
  - id: one
    title: One
    layout: content
`;

describe("layout maps", () => {
  it("loads the default collection when a theme omits layouts", () => {
    const layouts = resolveLayouts(undefined);
    expect(Object.keys(layouts).sort()).toEqual(["content", "quote", "section", "title"]);
    expect(completeTheme(undefined).layouts?.content).toEqual(DEFAULT_LAYOUTS.content);
    expect(layoutNames(undefined)).toEqual(["title", "section", "content", "quote"]);
  });

  it("keeps the default boxes from overlapping, including the footer and the body", () => {
    for (const map of Object.values(DEFAULT_LAYOUTS)) {
      const boxes = Object.entries(map);
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const left = boxes[i];
          const right = boxes[j];
          expect(left && right && boxesOverlap(left[1], right[1])).toBe(false);
        }
      }
    }
    const content = DEFAULT_LAYOUTS.content;
    expect(content?.body && content.footer && boxesOverlap(content.body, content.footer)).toBe(false);
  });

  it("uses a slide's own map instead of the theme layout", () => {
    const own = {
      title: { x: 0, y: 0, w: 100, h: 20 },
      body: { x: 0, y: 20, w: 100, h: 68 },
      footer: { x: 0, y: 88, w: 100, h: 8 },
    };
    expect(slideRegions({ layouts: DEFAULT_LAYOUTS }, { layout: "content", regions: own })).toEqual(own);
    expect(slideRegions(undefined, { layout: "content" })).toEqual(DEFAULT_LAYOUTS.content);
  });

  it("falls back to content when the layout name is not in the collection", () => {
    expect(slideRegions(undefined, { layout: "missing" })).toEqual(DEFAULT_LAYOUTS.content);
  });

  it("replaces one layout and still offers the defaults", () => {
    const theme = {
      layouts: {
        "two-column": {
          title: { x: 6, y: 5, w: 88, h: 12 },
          body: { x: 6, y: 18, w: 42, h: 68 },
          side: { x: 52, y: 18, w: 42, h: 68 },
          footer: { x: 6, y: 88, w: 88, h: 8 },
        },
      },
    };
    expect(layoutNames(theme)).toEqual(["title", "section", "content", "quote", "two-column"]);
    expect(slideRegions(theme, { layout: "two-column" }).side).toEqual({ x: 52, y: 18, w: 42, h: 68 });
  });

  it("rejects overlapping boxes and boxes that leave the page", () => {
    expect(() =>
      themeSchema.parse({
        layouts: {
          content: {
            title: { x: 0, y: 0, w: 100, h: 30 },
            body: { x: 0, y: 20, w: 100, h: 50 },
          },
        },
      }),
    ).toThrow(/overlaps/);
    expect(() =>
      themeSchema.parse({
        layouts: { content: { body: { x: 10, y: 10, w: 95, h: 20 } } },
      }),
    ).toThrow(/right edge/);
  });

  it("accepts a slide regions override and a theme with no layouts key", () => {
    const deck = parseDeck(`
id: deck
title: Talk
slides:
  - id: one
    title: One
    layout: content
    regions:
      body: { x: 5, y: 5, w: 90, h: 80 }
      footer: { x: 5, y: 88, w: 90, h: 8 }
`);
    expect(deck.slides[0]?.regions?.body).toEqual({ x: 5, y: 5, w: 90, h: 80 });
    const manifest = parseManifest("brand:\n  name: N\n  wordmark: N\n  accent: \"#112233\"\n  highlight: \"#AABBCC\"\n  mark: mark.svg\n");
    expect(manifest.theme).toBeUndefined();
    expect(resolveLayouts(manifest.theme).quote).toEqual(DEFAULT_LAYOUTS.quote);
  });

  it("scales a region down only until the floor", () => {
    expect(regionScale(100, 200)).toBe(1);
    expect(regionScale(120, 100)).toBe(0.833);
    expect(regionScale(200, 100)).toBe(REGION_SCALE_MIN);
    expect(regionScale(1000, 100)).toBe(REGION_SCALE_MIN);
  });
});

describe("insert layout", () => {
  it("writes the layout name the theme offered", () => {
    const inserted = insertSlide(talk, 0, "section");
    expect(parseDeck(inserted.yaml).slides[1]?.layout).toBe("section");
  });
});
