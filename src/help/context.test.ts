import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { helpContext, yamlKeyDoc } from "./context";

const source = `id: deck
title: Talk
slides:
  - id: one
    title: Open
    layout: content
    autoAdvance: 5
    theme:
      accent: "#112233"
    blocks:
      - type: bullets
        items:
          - text: First
            step: 1
      - type: chart
        kind: bar
        labels: [A, B]
        values: [1, 2]
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
  - id: hide
    title: Appendix
    layout: content
    hidden: true
`;

describe("help context", () => {
  const deck = parseDeck(source);

  it("describes the current slide when nothing is selected", () => {
    const focus = helpContext(deck, null, 0);
    expect(focus.title).toBe("Open");
    expect(focus.facts).toContain("Layout: content.");
    expect(focus.facts).toContain("1 build.");
    expect(focus.facts).toContain("No side column.");
    expect(focus.facts).toContain("1 question.");
    expect(focus.facts).toContain("Advances 5 seconds after the last build.");
  });

  it("follows a block, a question, or a field", () => {
    expect(helpContext(deck, ["slides", 0, "blocks", 0], 0).title).toBe("Bullets");
    expect(helpContext(deck, ["slides", 0, "blocks", 0, "items", 0, "text"], 0).title).toBe("Bullets");
    expect(helpContext(deck, ["slides", 0, "widgets", 0], 0).facts).toContain("Question: Ship?");
    expect(helpContext(deck, ["slides", 0, "title"], 0).title).toBe("title");
    expect(helpContext(deck, ["author"], 0).title).toBe("author");
    const hidden = helpContext(deck, null, 1);
    expect(hidden.facts).toContain("Hidden. Arrow keys skip it, and exports leave it out.");
  });
});

describe("yaml key docs", () => {
  it("reads the key under the pointer", () => {
    const advance = yamlKeyDoc(source, source.indexOf("autoAdvance"));
    expect(advance?.text).toMatch(/Seconds to wait/);
    expect(advance?.text).toMatch(/Optional/);
    expect(yamlKeyDoc(source, source.indexOf("autoAdvance") + 3)?.text).toMatch(/Optional/);

    const layout = yamlKeyDoc(source, source.indexOf("layout"));
    expect(layout?.text).toMatch(/One of: title, section, content, quote/);
    expect(layout?.text).toMatch(/Required/);

    expect(yamlKeyDoc(source, source.indexOf("step"))?.text).toMatch(/build/);
    expect(yamlKeyDoc(source, source.indexOf("kind"))?.text).toMatch(/One of: bar, column/);
    expect(yamlKeyDoc(source, source.indexOf("prompt"))?.text).toMatch(/Required/);
    expect(yamlKeyDoc(source, source.indexOf("accent"))?.text).toMatch(/accent color/);
    expect(yamlKeyDoc(source, source.indexOf("title"))?.text).toMatch(/toolbar/);
    expect(yamlKeyDoc(source, source.indexOf("title: Open"))?.text).toMatch(/heading/);
    expect(yamlKeyDoc(source, source.indexOf("content"))).toBeNull();
  });
});
