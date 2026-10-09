import type { ProbePath } from "./probe";
import { parseDeck } from "./parse";
import type { Block, Deck, Widget } from "./schema";
import { deleteYamlIn, insertYamlAt } from "./yamlLive";

export const BLOCK_KINDS = [
  "paragraph",
  "bullets",
  "numbered",
  "quote",
  "callout",
  "table",
  "chart",
  "mermaid",
  "link",
  "image",
  "video",
  "code",
  "divider",
] as const satisfies readonly Block["type"][];

export const WIDGET_KINDS = ["radio", "checkbox", "select", "text", "scale"] as const satisfies readonly Widget["type"][];

export const BLOCK_LABEL: Record<Block["type"], string> = {
  paragraph: "Paragraph",
  bullets: "Bullets",
  numbered: "Numbered",
  quote: "Quote",
  callout: "Callout",
  table: "Table",
  chart: "Chart",
  mermaid: "Mermaid",
  link: "Link",
  image: "Image",
  video: "Video",
  code: "Code",
  divider: "Divider",
};

export const WIDGET_LABEL: Record<Widget["type"], string> = {
  radio: "Radio",
  checkbox: "Checkbox",
  select: "Select",
  text: "Text",
  scale: "Scale",
};

export type InsertResult = {
  yaml: string;
  path: ProbePath;
};

export function freshId(used: Set<string>, base: string): string {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function usedIds(deck: Deck): Set<string> {
  const ids = new Set<string>([deck.id]);
  for (const slide of deck.slides) {
    ids.add(slide.id);
    for (const widget of slide.widgets ?? []) ids.add(widget.id);
  }
  return ids;
}

export function insertSlide(source: string, afterIndex: number): InsertResult {
  const deck = parseDeck(source);
  if (!Number.isInteger(afterIndex) || afterIndex < 0 || afterIndex >= deck.slides.length) {
    throw new Error("There is no slide at that position.");
  }
  const index = afterIndex + 1;
  const yaml = insertYamlAt(source, ["slides"], index, {
    id: freshId(usedIds(deck), "slide"),
    title: "Untitled",
    layout: "content",
  });
  return { yaml, path: ["slides", index] };
}

export function insertBlock(source: string, slideIndex: number, place: "blocks" | "side", type: Block["type"]): InsertResult {
  const deck = parseDeck(source);
  const slide = deck.slides[slideIndex];
  if (!slide) throw new Error("There is no slide at that position.");
  const index = slide[place]?.length ?? 0;
  const yaml = insertYamlAt(source, ["slides", slideIndex, place], index, blockValue(type));
  return { yaml, path: ["slides", slideIndex, place, index] };
}

export function insertWidget(source: string, slideIndex: number, type: Widget["type"]): InsertResult {
  const deck = parseDeck(source);
  const slide = deck.slides[slideIndex];
  if (!slide) throw new Error("There is no slide at that position.");
  const index = slide.widgets?.length ?? 0;
  const id = freshId(usedIds(deck), type);
  const yaml = insertYamlAt(source, ["slides", slideIndex, "widgets"], index, widgetValue(type, id));
  return { yaml, path: ["slides", slideIndex, "widgets", index] };
}

export function removeNode(source: string, path: ProbePath): string {
  const deck = parseDeck(source);
  if (path[0] === "slides" && typeof path[1] === "number" && path.length === 2 && deck.slides.length <= 1) {
    throw new Error("The last slide cannot be removed.");
  }
  return deleteYamlIn(source, path);
}

export function editParsed(source: string, failed: boolean, change: (source: string) => InsertResult): InsertResult | null {
  if (failed) return null;
  try {
    parseDeck(source);
  } catch {
    return null;
  }
  const result = change(source);
  parseDeck(result.yaml);
  return result;
}

export function removeParsed(source: string, failed: boolean, path: ProbePath): string | null {
  if (failed) return null;
  try {
    parseDeck(source);
  } catch {
    return null;
  }
  const next = removeNode(source, path);
  parseDeck(next);
  return next;
}

export function blockValue(type: Block["type"]): Block {
  switch (type) {
    case "paragraph":
      return { type, text: "Text" };
    case "bullets":
      return { type, items: [{ text: "Item" }] };
    case "numbered":
      return { type, items: [{ text: "Item" }] };
    case "quote":
      return { type, text: "Quote" };
    case "callout":
      return { type, text: "Note" };
    case "table":
      return { type, headers: ["A", "B"], rows: [["One", "Two"]] };
    case "chart":
      return { type, kind: "bar", labels: ["A", "B"], values: [1, 2] };
    case "mermaid":
      return { type, source: "flowchart LR\n  A --> B" };
    case "link":
      return { type, text: "Link", href: "https://example.com" };
    case "image":
      return { type, src: "https://example.com/image.png", alt: "Image" };
    case "video":
      return { type, src: "https://example.com/video.mp4" };
    case "code":
      return { type, code: "code" };
    case "divider":
      return { type };
    default: {
      const unreachable: never = type;
      throw new Error(`Unknown block ${String(unreachable)}.`);
    }
  }
}

export function widgetValue(type: Widget["type"], id: string): Widget {
  switch (type) {
    case "radio":
      return { id, type, prompt: "Choose", options: ["Yes", "No"] };
    case "checkbox":
      return { id, type, prompt: "Choose", options: ["Yes", "No"] };
    case "select":
      return { id, type, prompt: "Choose", options: ["Yes", "No"] };
    case "text":
      return { id, type, prompt: "Answer" };
    case "scale":
      return { id, type, prompt: "Rate" };
    default: {
      const unreachable: never = type;
      throw new Error(`Unknown widget ${String(unreachable)}.`);
    }
  }
}
