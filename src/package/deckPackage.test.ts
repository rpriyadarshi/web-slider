import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { readDeckPackage, writeDeckPackage } from "./deckPackage";

const deck = `
id: packed
title: Packed
slides:
  - id: one
    title: One
    layout: content
    blocks:
      - type: image
        src: images/mark.svg
        alt: Mark
`;

describe("deck package", () => {
  it("reads deck.yaml and the files it names", async () => {
    const zip = new JSZip();
    zip.file("deck.yaml", deck);
    zip.file("images/mark.svg", "<svg></svg>");
    const packed = await zip.generateAsync({ type: "arraybuffer" });
    const opened = await readDeckPackage(packed);
    expect(parseDeck(opened.yaml).id).toBe("packed");
    expect(opened.files.get("images/mark.svg")).toBeInstanceOf(Uint8Array);
  });

  it("writes a zip whose deck.yaml parses", async () => {
    const blob = await writeDeckPackage(deck, new Map([["images/mark.svg", new TextEncoder().encode("<svg></svg>")]]));
    const opened = await readDeckPackage(await blob.arrayBuffer());
    expect(parseDeck(opened.yaml).slides[0]?.blocks?.[0]).toMatchObject({ type: "image", src: "images/mark.svg" });
  });
});
