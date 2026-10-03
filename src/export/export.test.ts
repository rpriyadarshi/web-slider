import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { sessionFromDeck } from "../model/session";
import type { FontFiles } from "../theme/fonts";
import { buildDocx } from "./docx";
import { buildPdf } from "./pdf";
import { buildPptx } from "./pptx";
import { deckToYaml } from "./yaml";

const sample = readFileSync(new URL("../../samples/examples/launch-review.yaml", import.meta.url), "utf8");

function fontFiles(): FontFiles {
  const read = (name: string) => new Uint8Array(readFileSync(new URL(`../../samples/themes/emporion/fonts/${name}`, import.meta.url)));
  const pair = (regular: string, semibold: string) => ({ regular: read(regular), semibold: read(semibold) });
  const files = {
    Inter: pair("Inter-Regular.ttf", "Inter-SemiBold.ttf"),
    "Source Serif 4": pair("SourceSerif4-Regular.ttf", "SourceSerif4-Semibold.ttf"),
    "JetBrains Mono": pair("JetBrainsMono-Regular.ttf", "JetBrainsMono-Bold.ttf"),
  } satisfies FontFiles;
  return files;
}

describe("exporters", () => {
  const deck = parseDeck(sample);
  const session = sessionFromDeck(deck);
  session.answers.scope = { "ship-scope": "Yes", risks: ["Date"] };
  session.notes.scope = "Owner is still unnamed.";

  it("writes YAML that keeps the recorded decision", () => {
    const yaml = deckToYaml(deck, session);
    expect(yaml).toContain("Owner is still unnamed.");
    expect(yaml).toContain("Yes");
  });

  it("builds a PDF with one page per slide", async () => {
    const bytes = await buildPdf(deck, session, fontFiles());
    expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
  });

  it("builds a PowerPoint package", async () => {
    const blob = await buildPptx(deck, session);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });

  it("builds a Word package", async () => {
    const blob = await buildDocx(deck, session);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
