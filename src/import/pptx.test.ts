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
