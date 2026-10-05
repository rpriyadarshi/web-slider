import { historyKeymap, indentWithTab } from "@codemirror/commands";
import { foldKeymap } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import type { KeyBinding } from "@codemirror/view";

export { foldKeymap, historyKeymap, indentWithTab, searchKeymap };

export type KeyModifiers = { ctrlKey: boolean; metaKey: boolean; altKey: boolean };

type Shortcut = {
  id: string;
  keys: readonly string[];
  caps: readonly string[];
  about: string;
  keepsBlank?: boolean;
  presenterOnly?: boolean;
};

export const SHORTCUTS = [
  {
    id: "forward",
    keys: ["ArrowRight", "ArrowDown", "PageDown", " "],
    caps: ["→", "↓", "Page Down", "Space"],
    about: "Reveal the next build, then go to the next slide. Hidden slides are skipped.",
  },
  {
    id: "back",
    keys: ["ArrowLeft", "ArrowUp", "PageUp"],
    caps: ["←", "↑", "Page Up"],
    about: "Go back one build, then one slide. Hidden slides are skipped.",
  },
  {
    id: "home",
    keys: ["Home"],
    caps: ["Home"],
    about: "Jump to the first visible slide.",
  },
  {
    id: "end",
    keys: ["End"],
    caps: ["End"],
    about: "Jump to the last visible slide, fully revealed.",
  },
  {
    id: "digit",
    keys: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    caps: ["0–9"],
    about: "Type a visible slide number, then press Enter.",
  },
  {
    id: "jump",
    keys: ["Enter"],
    caps: ["Enter"],
    about: "Jump to the slide number you just typed.",
  },
  {
    id: "overview",
    keys: ["o", "O"],
    caps: ["O"],
    about: "Show every slide, or close that grid.",
  },
  {
    id: "fullscreen",
    keys: ["f", "F"],
    caps: ["F"],
    about: "Fill the screen with this window, or leave full screen.",
  },
  {
    id: "blank-black",
    keys: ["b", "B"],
    caps: ["B"],
    about: "Blank the audience window in black. Any other key brings the slide back and does not move.",
    keepsBlank: true,
  },
  {
    id: "blank-white",
    keys: ["w", "W"],
    caps: ["W"],
    about: "Blank the audience window in white. Any other key brings the slide back and does not move.",
    keepsBlank: true,
  },
  {
    id: "laser",
    keys: ["l", "L"],
    caps: ["L"],
    about: "Turn the pointer on or off. Move over the slide. The audience window follows.",
    keepsBlank: true,
    presenterOnly: true,
  },
  {
    id: "captions",
    keys: ["c", "C"],
    caps: ["C"],
    about: "Turn live captions from the microphone on or off.",
    keepsBlank: true,
    presenterOnly: true,
  },
  {
    id: "help",
    keys: ["?"],
    caps: ["?"],
    about: "Open or close help.",
    presenterOnly: true,
  },
  {
    id: "escape",
    keys: ["Escape"],
    caps: ["Esc"],
    about: "Close the open menu, or a floating pane. A docked pane stays. A menu closes before a pane.",
  },
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]["id"];

const NONE: KeyModifiers = { ctrlKey: false, metaKey: false, altKey: false };

export function shortcutFor(key: string, modifiers: KeyModifiers = NONE): Shortcut | null {
  if (modifiers.ctrlKey || modifiers.metaKey || modifiers.altKey) return null;
  return SHORTCUTS.find((row) => (row.keys as readonly string[]).includes(key)) ?? null;
}

export function shortcutCaps(id: ShortcutId): readonly string[] {
  const row = SHORTCUTS.find((item) => item.id === id);
  if (!row) throw new Error(`Unknown shortcut ${id}.`);
  return row.caps;
}

export function editorBindings(): KeyBinding[] {
  return [...historyKeymap, ...searchKeymap, ...foldKeymap, indentWithTab];
}

const EDITOR_ABOUT: Record<string, string> = {
  "Mod-z||": "Undo the last edit in the YAML.",
  "Mod-y|Mod-Shift-z|": "Redo the last edit in the YAML.",
  "||Ctrl-Shift-z": "Redo the last edit in the YAML on Linux.",
  "Mod-u||": "Undo the last cursor or selection change in the YAML.",
  "Alt-u|Mod-Shift-u|": "Redo the last cursor or selection change in the YAML.",
  "Mod-f||": "Find and replace in the YAML.",
  "F3||": "Find the next match. With Shift, find the previous match.",
  "Mod-g||": "Find the next match. With Shift, find the previous match.",
  "Escape||": "Close the find bar.",
  "Mod-Shift-l||": "Select every match of the current selection.",
  "Mod-Alt-g||": "Go to a line number.",
  "Mod-d||": "Add the next match of the current selection.",
  "Ctrl-Shift-[|Cmd-Alt-[|": "Fold the block at the cursor.",
  "Ctrl-Shift-]|Cmd-Alt-]|": "Unfold the block at the cursor.",
  "Ctrl-Alt-[||": "Fold every block.",
  "Ctrl-Alt-]||": "Unfold every block.",
  "Tab||": "Indent the current line.",
};

function bindingId(binding: KeyBinding): string {
  return `${binding.key ?? ""}|${binding.mac ?? ""}|${binding.linux ?? ""}`;
}

function chord(value: string, mac: boolean): string {
  const parts = value.split("-").map((part) => {
    if (part === "Mod") return mac ? "⌘" : "Ctrl";
    if (part === "Cmd") return "⌘";
    if (part === "Shift") return mac ? "⇧" : "Shift";
    if (part === "Alt") return mac ? "⌥" : "Alt";
    if (part === "Ctrl") return mac ? "⌃" : "Ctrl";
    return part.length === 1 ? part.toUpperCase() : part;
  });
  return mac ? parts.join("") : parts.join("+");
}

export function capsOf(binding: KeyBinding): string[] {
  const caps: string[] = [];
  if (binding.key) {
    caps.push(chord(binding.key, false));
    if (binding.key.split("-").includes("Mod") && binding.mac === undefined) caps.push(chord(binding.key, true));
  }
  if (binding.mac && binding.mac !== binding.key) caps.push(chord(binding.mac, true));
  if (binding.linux && binding.linux !== binding.key && binding.linux !== binding.mac) caps.push(chord(binding.linux, false));
  if (caps.length === 0) throw new Error(`Editor binding ${bindingId(binding)} has no key.`);
  return caps;
}

export type EditorKey = { caps: string[]; about: string };

export function editorKeys(): EditorKey[] {
  return editorBindings().map((binding) => {
    const id = bindingId(binding);
    const about = EDITOR_ABOUT[id];
    if (!about) throw new Error(`No help for editor key ${id}.`);
    return { caps: capsOf(binding), about };
  });
}

export function editorCaps(match: (binding: KeyBinding) => boolean): string[] {
  const binding = editorBindings().find(match);
  if (!binding) throw new Error("That editor key is not installed.");
  return capsOf(binding);
}
