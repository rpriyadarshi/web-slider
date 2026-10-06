import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { readDeckPackage } from "./deckPackage";
import { packDeckFile } from "./packTalk";

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const png = Buffer.from(pngBase64, "base64");

const talk = `id: packed
title: Packed
slides:
  - id: one
    title: One
    layout: content
`;

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "web-slider-pack-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeTalk(yaml: string, name = "talk.yaml"): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, yaml);
  return file;
}

describe("packDeckFile", () => {
  it("accepts a talk with no package files and writes no zip", async () => {
    const deck = await writeTalk(`${talk}    blocks:\n      - type: image\n        src: https://example.com/a.png\n      - type: image\n        src: data:image/png;base64,${pngBase64}\n`);
    const packed = await packDeckFile(deck);
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    expect(packed.wroteZip).toBe(false);
    expect(packed.message).toMatch(/no zip was written/);
    expect(packed.message).toContain(deck);
    await expect(readFile(`${deck.slice(0, -5)}.zip`)).rejects.toThrow();
  });

  it("packs the files the talk names after the presenter accepts the bytes", async () => {
    await mkdir(path.join(dir, "diagrams"));
    await writeFile(path.join(dir, "diagrams", "a.png"), png);
    const deck = await writeTalk(`${talk}    blocks:\n      - type: image\n        src: diagrams/a.png\n`);
    const packed = await packDeckFile(deck);
    expect(packed.ok).toBe(true);
    if (!packed.ok || !packed.outPath) return;
    const file = await readFile(packed.outPath);
    const copy = new ArrayBuffer(file.byteLength);
    new Uint8Array(copy).set(file);
    const opened = await readDeckPackage(copy);
    expect(parseDeck(opened.yaml).slides[0]?.blocks?.[0]).toMatchObject({ type: "image", src: "diagrams/a.png" });
    expect(opened.files.get("diagrams/a.png")).toEqual(Uint8Array.from(png));
    expect([...opened.files.keys()].filter((name) => name !== "deck.yaml").sort()).toEqual(["diagrams/a.png"]);
  });

  it("writes nothing and reports every problem", async () => {
    await mkdir(path.join(dir, "diagrams"));
    await writeFile(path.join(dir, "diagrams", "notes.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const deck = await writeTalk(`${talk}    blocks:\n      - type: code\n        language: mermaid\n        code: "graph TD"\n      - type: image\n        src: diagrams/missing.png\n      - type: image\n        src: diagrams/notes.png\n`);
    const packed = await packDeckFile(deck);
    expect(packed.ok).toBe(false);
    if (packed.ok) return;
    expect(packed.problems.join("\n")).toMatch(/Cannot highlight language "mermaid"/);
    expect(packed.problems.join("\n")).toMatch(/diagrams\/missing\.png/);
    expect(packed.problems.join("\n")).toMatch(/PNG is truncated/);
    await expect(readFile(path.join(dir, "talk.zip"))).rejects.toThrow();
  });

  it("rejects a data URI the exporter would reject", async () => {
    const deck = await writeTalk(`${talk}    blocks:\n      - type: image\n        src: "data:image/svg+xml,<svg></svg>"\n`);
    const packed = await packDeckFile(deck);
    expect(packed.ok).toBe(false);
    if (packed.ok) return;
    expect(packed.problems.join("\n")).toMatch(/Only PNG and JPEG images can be exported/);
  });

  it("reports schema failures from the presenter and writes nothing", async () => {
    const deck = await writeTalk("id: bad\nslides: []\n");
    const packed = await packDeckFile(deck);
    expect(packed.ok).toBe(false);
    if (packed.ok) return;
    expect(packed.problems.join("\n")).toMatch(/Deck failed validation/);
    await expect(readFile(path.join(dir, "talk.zip"))).rejects.toThrow();
  });

  it("refuses a package file that resolves outside the talk directory", async () => {
    const outside = await mkdtemp(path.join(os.tmpdir(), "web-slider-pack-outside-"));
    try {
      await writeFile(path.join(outside, "secret.png"), png);
      await mkdir(path.join(dir, "diagrams"));
      await symlink(path.join(outside, "secret.png"), path.join(dir, "diagrams", "a.png"));
      const deck = await writeTalk(`${talk}    blocks:\n      - type: image\n        src: diagrams/a.png\n`);
      const packed = await packDeckFile(deck);
      expect(packed.ok).toBe(false);
      if (packed.ok) return;
      expect(packed.problems.join("\n")).toMatch(/outside the talk directory/);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});
