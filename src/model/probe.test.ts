import { describe, expect, it } from "vitest";
import { locateProbe, probeAt, probeKey } from "./probe";

const source = `id: review
title: Review
footer: Hello
slides:
  - id: scope
    title: Scope
    blocks:
      - type: bullets
        items:
          - text: First
          - text: Second
`;

describe("YAML cross-probe", () => {
  it("finds a slide title and a bullet from a path", () => {
    const title = locateProbe(source, ["slides", 0, "title"]);
    expect(title && source.slice(title.start, title.end)).toContain("title: Scope");
    const bullet = locateProbe(source, ["slides", 0, "blocks", 0, "items", 1]);
    expect(bullet && source.slice(bullet.start, bullet.end)).toContain("Second");
    const list = locateProbe(source, ["slides", 0, "blocks", 0]);
    const listText = list ? source.slice(list.start, list.end) : "";
    expect(listText).toContain("First");
    expect(listText).toContain("Second");
  });

  it("resolves the caret to the deepest node", () => {
    const offset = source.indexOf("text: Second");
    expect(probeKey(probeAt(source, offset + 2) ?? [])).toBe("slides/0/blocks/0/items/1/text");
  });
});
