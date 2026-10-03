import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { sessionFromDeck } from "../model/session";
import { blockToText } from "../model/text";
import { buildHandout } from "./docx";

const source = `
id: review
title: Review
slides:
  - id: open
    title: Visible talk
    layout: content
    notes: Say this.
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
    blocks:
      - type: numbered
        items:
          - text: First
      - type: table
        headers: [Option, Owner]
        rows:
          - [Friday, Chair]
      - type: link
        text: Docs
        href: https://example.com/docs
  - id: secret
    title: Hidden appendix
    hidden: true
    layout: content
    notes: Do not print.
`;

describe("handout", () => {
  it("writes the script, answers, and notes, and omits the hidden slide", async () => {
    const deck = parseDeck(source);
    const numbered = deck.slides[0]?.blocks?.[0];
    const table = deck.slides[0]?.blocks?.[1];
    const link = deck.slides[0]?.blocks?.[2];
    expect(numbered && blockToText(numbered)).toBe("1. First");
    expect(table && blockToText(table)).toBe("Option | Owner\nFriday | Chair");
    expect(link && blockToText(link)).toBe("Docs (https://example.com/docs)");

    const session = sessionFromDeck(deck);
    session.answers.open = { ship: "Yes" };
    session.notes.open = "They said yes.";
    const blob = await buildHandout(deck, session);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toBeTruthy();
    expect(xml).toContain("Visible talk");
    expect(xml).toContain("Say this.");
    expect(xml).toContain("They said yes.");
    expect(xml).toContain("Ship?");
    expect(xml).not.toContain("Hidden appendix");
    expect(xml).not.toContain("Do not print.");
  });
});
