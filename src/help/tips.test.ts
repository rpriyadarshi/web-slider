import { describe, expect, it } from "vitest";
import { parseDeck } from "../model/parse";
import { backTip, counterTip, forwardTip, insertBlocked, removeSlideTip, removeTip } from "./tips";

const deck = parseDeck(`id: deck
title: Talk
slides:
  - id: one
    title: Open
    layout: content
    blocks:
      - type: bullets
        items:
          - text: First
            step: 1
          - text: Second
            step: 2
  - id: hide
    title: Appendix
    layout: content
    hidden: true
  - id: two
    title: Close
    layout: section
`);

describe("navigation tips", () => {
  it("names the next build, the next slide, and the end", () => {
    expect(forwardTip(deck, 0, 0)).toBe("Reveals build 1 of 2.");
    expect(forwardTip(deck, 0, 1)).toBe("Reveals build 2 of 2.");
    expect(forwardTip(deck, 0, 2)).toBe("Slide 2: Close");
    expect(forwardTip(deck, 1, 0)).toBe("Slide 2: Close");
    expect(forwardTip(deck, 2, 0)).toBe("End of the talk.");
  });

  it("names the previous build and skips a hidden slide", () => {
    expect(backTip(deck, 0, 0)).toBe("Start of the talk.");
    expect(backTip(deck, 0, 1)).toBe("Returns to the start of this slide.");
    expect(backTip(deck, 0, 2)).toBe("Returns to build 1 of 2.");
    expect(backTip(deck, 2, 0)).toBe("Slide 1: Open, build 2 of 2.");
  });

  it("says when the current slide is hidden", () => {
    expect(counterTip(deck, 0)).toBe("Slide 1 of 2.");
    expect(counterTip(deck, 1)).toBe("This slide is hidden. Arrow keys skip it.");
  });
});

describe("edit tips", () => {
  it("explains remove, remove slide, and a blocked insert", () => {
    expect(removeTip(deck, null, null)).toBe("Select a block or a question first.");
    expect(removeTip(deck, ["slides", 0, "blocks", 0], null)).toBe("Removes the Bullets block from the slide.");
    expect(removeTip(deck, ["slides", 0, "title"], "bad yaml")).toBe("The YAML has an error, so nothing can be removed until it parses.");
    expect(removeSlideTip(deck, 2, null)).toBe('Removes "Close".');
    expect(removeSlideTip(deck, 0, "bad yaml")).toBe("The YAML has an error, so the slide cannot be removed until it parses.");
    const only = parseDeck("id: deck\ntitle: Talk\nslides:\n  - id: one\n    title: Only\n    layout: content\n");
    expect(removeSlideTip(only, 0, null)).toBe("The last slide cannot be removed.");
    expect(insertBlocked("bad yaml")).toBe("The YAML has an error, so nothing can be inserted until it parses.");
    expect(insertBlocked(null)).toBeNull();
  });
});
