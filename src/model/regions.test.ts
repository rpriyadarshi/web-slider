import { describe, expect, it } from "vitest";
import { completeTheme, parseManifest } from "./install";
import { insertSlide } from "./insert";
import { parseDeck } from "./parse";
import { themeSchema } from "./schema";
import {
  boxesOverlap,
  DEFAULT_LAYOUTS,
  isColumnLabel,
  layoutNames,
  REGION_SCALE_MIN,
  regionScale,
  resolveLayouts,
  slideRegions,
  tableCells,
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

  it("uses the layout the slide names", () => {
    const brief = {
      title: { x: 4, y: 0, w: 92, h: 10 },
      body: { x: 4, y: 12, w: 92, h: 80 },
      footer: { x: 4, y: 93, w: 92, h: 7 },
    };
    expect(slideRegions({ layouts: { brief } }, { layout: "brief" })).toEqual(brief);
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

  it("lets the talk replace a theme layout and fill the other regions from slots", () => {
    const talk = {
      layouts: {
        title: {
          title: { x: 6, y: 30, w: 80, h: 12 },
          footer: { x: 6, y: 88, w: 88, h: 8 },
        },
      },
    };
    expect(slideRegions({ layouts: { title: DEFAULT_LAYOUTS.title ?? {} } }, { layout: "title" }, talk).title).toEqual({
      x: 6,
      y: 30,
      w: 80,
      h: 12,
    });
    const parsed = parseDeck(`
id: deck
title: Talk
layouts:
  three-reasons:
    title: { x: 4, y: 8, w: 92, h: 9 }
    cost: { x: 6, y: 25, w: 25, h: 61 }
    footer: { x: 4, y: 93, w: 92, h: 7 }
slides:
  - id: one
    title: Three reasons
    layout: three-reasons
    slots:
      cost:
        - type: paragraph
          text: Expensive on a per-seat basis
`);
    expect(parsed.slides[0]?.slots?.cost?.[0]).toMatchObject({ text: "Expensive on a per-seat basis" });
    expect(() =>
      parseDeck(`
id: deck
title: Talk
layouts:
  three-reasons:
    title: { x: 4, y: 8, w: 92, h: 9 }
    cost: { x: 6, y: 25, w: 25, h: 61 }
slides:
  - id: one
    title: Three reasons
    layout: three-reasons
    slots:
      missing:
        - type: paragraph
          text: No
`),
    ).toThrow(/not a region/);
    expect(() =>
      parseDeck(`
id: deck
title: Talk
layouts:
  three-reasons:
    title: { x: 4, y: 8, w: 92, h: 9 }
    body: { x: 6, y: 25, w: 88, h: 60 }
slides:
  - id: one
    title: Three reasons
    layout: three-reasons
    slots:
      body:
        - type: paragraph
          text: No
`),
    ).toThrow(/slide field/);
  });

  it("rejects boxes on a slide and still loads defaults when a theme omits layouts", () => {
    expect(() =>
      parseDeck(`
id: deck
title: Talk
slides:
  - id: one
    title: One
    layout: content
    regions:
      body: { x: 5, y: 5, w: 90, h: 80 }
`),
    ).toThrow(/regions/);
    const manifest = parseManifest("brand:\n  name: N\n  wordmark: N\n  accent: \"#112233\"\n  highlight: \"#AABBCC\"\n  mark: mark.svg\n");
    expect(manifest.theme).toBeUndefined();
    expect(resolveLayouts(manifest.theme).quote).toEqual(DEFAULT_LAYOUTS.quote);
  });

  it("treats aligned comparison columns as one table and marks the recommended column", () => {
    expect(isColumnLabel("OPTION B — RECOMMENDED")).toBe(true);
    expect(isColumnLabel("Layer entry")).toBe(false);
    const regions = {
      title: { x: 4, y: 8, w: 92, h: 9 },
      "option-a": { x: 6, y: 24, w: 25, h: 11 },
      "option-b": { x: 37, y: 24, w: 25, h: 11 },
      "option-c": { x: 68, y: 24, w: 25, h: 11 },
      "what-it-is": { x: 6, y: 36, w: 25, h: 52 },
      "what-it-is-2": { x: 37, y: 36, w: 25, h: 52 },
      "what-it-is-3": { x: 68, y: 36, w: 25, h: 52 },
    };
    const texts: Record<string, string[]> = {
      "option-a": ["OPTION A", "Layer entry"],
      "option-b": ["OPTION B — RECOMMENDED", "Shadow system of record"],
      "option-c": ["OPTION C", "Greenfield CRM"],
      "what-it-is": ["WHAT IT IS", "A trust layer."],
      "what-it-is-2": ["WHAT IT IS", "AI captures the deal."],
      "what-it-is-3": ["WHAT IT IS", "A full CRM."],
    };
    const cells = tableCells(regions, (name) => texts[name] ?? []);
    expect(cells["option-a"]).toMatchObject({ row: 0, col: 0, emphasis: false, comparison: true });
    expect(cells["option-b"]).toMatchObject({ row: 0, col: 1, emphasis: true, comparison: true });
    expect(cells["what-it-is-3"]).toMatchObject({ row: 1, col: 2, emphasis: false, comparison: true });
    expect(cells.title).toBeUndefined();
  });

  it("does not lock a dark panel to the column of prose beside it, and ignores arrows", () => {
    const regions = {
      story: { x: 4, y: 20, w: 54, h: 60 },
      impact: { x: 60, y: 20, w: 36, h: 60, tone: "inverse" as const },
      arrow: { x: 56, y: 40, w: 3, h: 6 },
    };
    const cells = tableCells(regions, (name) => (name === "arrow" ? ["→"] : ["IMPACT"]));
    expect(cells.impact).toBeUndefined();
    expect(cells.story).toBeUndefined();
    expect(cells.arrow).toBeUndefined();
  });

  it("scales a region down only until the floor", () => {
    expect(regionScale(100, 200)).toBe(1);
    expect(regionScale(120, 100)).toBe(0.833);
    expect(regionScale(200, 100)).toBe(0.5);
    expect(regionScale(1000, 100)).toBe(REGION_SCALE_MIN);
  });
});

describe("insert layout", () => {
  it("writes the layout name the theme offered", () => {
    const inserted = insertSlide(talk, 0, "section");
    expect(parseDeck(inserted.yaml).slides[1]?.layout).toBe("section");
  });
});
