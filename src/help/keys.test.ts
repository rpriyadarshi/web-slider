import { describe, expect, it } from "vitest";
import { CONTROLS } from "./controls";
import { editorKeys, shortcutCaps, shortcutFor, SHORTCUTS } from "./keys";

const plain = { ctrlKey: false, metaKey: false, altKey: false };

describe("presenter shortcuts", () => {
  it("resolves every key to one row", () => {
    const seen = new Map<string, string>();
    for (const row of SHORTCUTS) {
      for (const key of row.keys) {
        expect(seen.has(key)).toBe(false);
        seen.set(key, row.id);
        expect(shortcutFor(key, plain)?.id).toBe(row.id);
      }
    }
  });

  it("ignores ctrl, alt, and meta", () => {
    expect(shortcutFor("c", { ctrlKey: true, metaKey: false, altKey: false })).toBeNull();
    expect(shortcutFor("l", { ctrlKey: false, metaKey: true, altKey: false })).toBeNull();
    expect(shortcutFor("f", { ctrlKey: false, metaKey: false, altKey: true })).toBeNull();
    expect(shortcutFor("?", { ctrlKey: true, metaKey: false, altKey: false })).toBeNull();
    expect(shortcutFor("?", plain)?.id).toBe("help");
    expect(shortcutFor("B", plain)?.id).toBe("blank-black");
  });

  it("keeps the blank screen only for B, W, L, and C", () => {
    const keys = SHORTCUTS.filter((row) => "keepsBlank" in row && row.keepsBlank).flatMap((row) => row.keys.map((key) => key.toLowerCase()));
    expect(new Set(keys)).toEqual(new Set(["b", "w", "l", "c"]));
  });

  it("documents every shortcut a control names", () => {
    for (const item of CONTROLS) {
      if ("shortcut" in item && item.shortcut) expect(shortcutCaps(item.shortcut).length).toBeGreaterThan(0);
    }
  });
});

describe("editor keys", () => {
  it("describes every installed binding", () => {
    const rows = editorKeys();
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(row.about.length).toBeGreaterThan(5);
      expect(row.caps.length).toBeGreaterThan(0);
    }
    expect(rows.find((row) => row.caps.includes("Ctrl+Z"))?.about).toMatch(/Undo/);
    expect(rows.find((row) => row.caps.includes("Ctrl+F"))?.about).toMatch(/Find/);
  });
});
