import PptxGenJS from "pptxgenjs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { blockToText } from "../model/text";
import { importPptx } from "./pptx";

describe("importPptx", () => {
  it("keeps the title, bullets, and notes, and drops everything else", async () => {
    const pptx = new PptxGenJS();
    pptx.title = "Launch Review";
    const slide = pptx.addSlide();
    slide.addText("Scope is the constraint", { x: 0.5, y: 0.4, w: 12, h: 0.8, fontSize: 28, bold: true });
    slide.addText(
      [
        { text: "Export the deck", options: { bullet: true, breakLine: true } },
        { text: "Keep the notes", options: { bullet: true } },
      ],
      { x: 0.5, y: 1.6, w: 12, h: 2, fontSize: 18 },
    );
    slide.addNotes("Say the decision.");
    const output = await pptx.write({ outputType: "arraybuffer" });
    const deck = parseDeck(await importPptx(output as ArrayBuffer, "Launch Review.pptx"));
    expect(deck.id).toBe("launch-review");
    expect(deck.title).toBe("Launch Review");
    expect(deck.slides).toHaveLength(1);
    expect(deck.slides[0]).toMatchObject({
      title: "Scope is the constraint",
      notes: "Say the decision.",
    });
    const bullets = deck.slides[0]?.blocks?.find((block) => block.type === "bullets");
    expect(bullets && blockToText(bullets)).toBe("• Export the deck\n• Keep the notes");
  });

  it("keeps side-by-side text in slots and does not rewrite it", async () => {
    const pptx = new PptxGenJS();
    pptx.title = "Three reasons";
    const slide = pptx.addSlide();
    slide.addText("Three reasons the CRM stopped paying for itself", { x: 0.4, y: 0.3, w: 12.2, h: 0.7, fontSize: 28 });
    slide.addText("Expensive on a per-seat basis", { x: 0.4, y: 1.6, w: 3.6, h: 1.4, fontSize: 16 });
    slide.addText("Little impact on the sales process itself", { x: 4.6, y: 1.6, w: 3.6, h: 1.4, fontSize: 16 });
    slide.addText("Enterprises can't run the business on it", { x: 8.8, y: 1.6, w: 3.6, h: 1.4, fontSize: 16 });
    const output = await pptx.write({ outputType: "arraybuffer" });
    const deck = parseDeck(await importPptx(output as ArrayBuffer, "Three reasons.pptx"));
    const page = deck.slides[0];
    const texts = Object.values(page?.slots ?? {})
      .flat()
      .map((block) => (block.type === "paragraph" ? block.text : ""))
      .filter(Boolean);
    expect(page?.title).toBe("Three reasons the CRM stopped paying for itself");
    expect(texts).toEqual([
      "Expensive on a per-seat basis",
      "Little impact on the sales process itself",
      "Enterprises can't run the business on it",
    ]);
    expect(deck.layouts?.[page?.layout ?? ""]?.title).toBeDefined();
    expect(Object.keys(page?.slots ?? {})).toHaveLength(3);
  });

  it("keeps stacked paragraphs in the boxes the source gave them", async () => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";
    const slide = pptx.addSlide();
    slide.addText("00 — starting point", { x: 0.7, y: 0.5, w: 10, h: 0.35, fontSize: 14 });
    slide.addText("What our product is needs careful thought.", { x: 0.9, y: 1.4, w: 11, h: 2.1, fontSize: 16 });
    slide.addText("The old adage is to focus.", { x: 0.9, y: 4.2, w: 11, h: 1.6, fontSize: 16 });
    const output = await pptx.write({ outputType: "arraybuffer" });
    const deck = parseDeck(await importPptx(output as ArrayBuffer, "stacked.pptx"));
    const page = deck.slides[0];
    const texts = [...(page?.blocks ?? []), ...Object.values(page?.slots ?? {}).flat()]
      .filter((block) => block.type === "paragraph")
      .map((block) => block.text);
    expect(texts).toEqual(["What our product is needs careful thought.", "The old adage is to focus."]);
    expect(Object.keys(page?.slots ?? {})).toHaveLength(2);
  });

  it("keeps italics and an arrow, and paints a dark panel with the theme text color", async () => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";
    const slide = pptx.addSlide();
    slide.addText("A dark panel", { x: 0.5, y: 0.4, w: 12, h: 0.6, fontSize: 28 });
    slide.addShape("rect", { x: 8, y: 1.6, w: 4.5, h: 3, fill: { color: "0E2841" } });
    slide.addText("WHAT THIS SIGNALS", { x: 8.2, y: 1.8, w: 4, h: 0.4, fontSize: 12, bold: true, color: "0F9ED5" });
    slide.addText("This line stays italic.", { x: 8.2, y: 2.3, w: 4, h: 1.2, fontSize: 14, italic: true, color: "FFFFFF" });
    slide.addText("→", { x: 6.6, y: 2.4, w: 0.4, h: 0.4, fontSize: 20, bold: true });
    const output = await pptx.write({ outputType: "arraybuffer" });
    const deck = parseDeck(await importPptx(output as ArrayBuffer, "emphasis.pptx"));
    const page = deck.slides[0];
    const paragraphs = [...(page?.blocks ?? []), ...Object.values(page?.slots ?? {}).flat()].filter((block) => block.type === "paragraph");
    expect(paragraphs.some((block) => block.type === "paragraph" && block.italic && block.text.includes("italic"))).toBe(true);
    expect(paragraphs.some((block) => block.type === "paragraph" && block.text === "→")).toBe(true);
    const italic = paragraphs.find((block) => block.type === "paragraph" && block.italic);
    const regionName = Object.entries(page?.slots ?? {}).find(([, blocks]) => blocks.some((block) => block.type === "paragraph" && block.italic))?.[0];
    const region = deck.layouts?.[page?.layout ?? ""]?.[regionName ?? ""];
    const ground = Object.values(deck.layouts?.[page?.layout ?? ""] ?? {}).find((box) => box.ground);
    expect(ground?.tone).toBe("inverse");
    expect(ground?.h).toBeGreaterThan(30);
    expect(region?.ink).toBe("inverse");
    expect(italic?.text).toContain("italic");
    expect(italic?.type === "paragraph" && italic.size).toBe(14);
  });

  it("keeps a round card behind its text and a circle behind its number", async () => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";
    const slide = pptx.addSlide();
    slide.addText("Next steps", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28 });
    slide.addShape("roundRect", { x: 0.5, y: 1.5, w: 6, h: 4, fill: { color: "F4F6F8" }, rectRadius: 0.15 });
    slide.addText("Today", { x: 0.8, y: 1.8, w: 5, h: 0.5, fontSize: 16 });
    slide.addShape("ellipse", { x: 8, y: 1.6, w: 0.7, h: 0.7, fill: { color: "0F9ED5" } });
    slide.addText("1", { x: 8, y: 1.6, w: 0.7, h: 0.7, fontSize: 14, bold: true, color: "FFFFFF", align: "center" });
    const output = await pptx.write({ outputType: "arraybuffer" });
    const deck = parseDeck(await importPptx(output as ArrayBuffer, "cards.pptx"));
    const boxes = Object.values(deck.layouts?.[deck.slides[0]?.layout ?? ""] ?? {});
    expect(boxes.some((box) => box.ground && box.shape === "round" && box.tone === "band")).toBe(true);
    expect(boxes.some((box) => box.ground && box.shape === "circle" && box.tone === "accent")).toBe(true);
    const texts = Object.values(deck.slides[0]?.slots ?? {}).flat().map((block) => (block.type === "paragraph" ? block.text : ""));
    expect(texts).toEqual(expect.arrayContaining(["Today", "1"]));
  });

  it("keeps cells on a tinted row side by side", async () => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "WIDE", width: 13.33, height: 7.5 });
    pptx.layout = "WIDE";
    const slide = pptx.addSlide();
    slide.addText("Where the work sits", { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28 });
    slide.addShape("rect", { x: 0.5, y: 1.6, w: 12, h: 0.8, fill: { color: "DDEFFA" } });
    slide.addText("3", { x: 0.6, y: 1.7, w: 0.6, h: 0.6, fontSize: 14, bold: true, color: "0F9ED5" });
    slide.addText("Connectivity", { x: 1.4, y: 1.7, w: 4, h: 0.6, fontSize: 14 });
    const output = await pptx.write({ outputType: "arraybuffer" });
    const deck = parseDeck(await importPptx(output as ArrayBuffer, "rows.pptx"));
    const page = deck.slides[0];
    const slots = Object.entries(page?.slots ?? {});
    expect(slots).toHaveLength(2);
    const boxes = Object.values(deck.layouts?.[page?.layout ?? ""] ?? {});
    expect(boxes.some((box) => box.ground && box.tone === "wash")).toBe(true);
    const texts = slots.flatMap(([, blocks]) => blocks.map((block) => (block.type === "paragraph" ? block.text : "")));
    expect(texts).toEqual(expect.arrayContaining(["3", "Connectivity"]));
  });

  it("rejects a file that is not a presentation", async () => {
    await expect(importPptx(new Uint8Array([1, 2, 3]), "notes.pptx")).rejects.toThrow();
  });
});

describe("chart and video text", () => {
  it("rejects a video that is not https and a chart whose values do not match", () => {
    expect(() =>
      parseDeck(`
id: review
title: Review
slides:
  - id: one
    title: One
    layout: content
    blocks:
      - type: video
        src: notes.mp4
`),
    ).toThrow(/https/);
    expect(() =>
      parseDeck(`
id: review
title: Review
slides:
  - id: one
    title: One
    layout: content
    blocks:
      - type: chart
        kind: bar
        labels: [Friday]
        values: [1, 2]
`),
    ).toThrow(/values/);
  });
});
