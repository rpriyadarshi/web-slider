import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadRecent, rememberRecent } from "./recent";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
    },
  });
});

afterEach(() => {
  memory.clear();
});

describe("recent talks", () => {
  it("remembers catalog paths with the newest first", () => {
    rememberRecent({ title: "Launch Review", path: "samples/examples/launch-review.yaml" });
    rememberRecent({ title: "Harbor", path: "samples/examples/harbor/briefing.yaml" });
    rememberRecent({ title: "Launch Review", path: "samples/examples/launch-review.yaml" });
    expect(loadRecent().map((row) => row.path)).toEqual([
      "samples/examples/launch-review.yaml",
      "samples/examples/harbor/briefing.yaml",
    ]);
  });
});
