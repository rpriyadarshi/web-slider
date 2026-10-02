import type { Block, Widget } from "./schema";
import type { WidgetAnswer } from "./session";

export function formatAnswer(answer: WidgetAnswer | undefined): string {
  if (answer === undefined) return "";
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer);
}

export function blockToText(block: Block): string {
  switch (block.type) {
    case "paragraph":
    case "callout":
      return block.text;
    case "quote":
      return block.attribution ? `"${block.text}" — ${block.attribution}` : `"${block.text}"`;
    case "bullets":
      return block.items.map((item) => `• ${item.text}`).join("\n");
    case "code":
      return block.code.replace(/\s+$/, "");
    case "image":
      return block.alt ? `[Image: ${block.alt}]` : "[Image]";
    case "divider":
      return "";
  }
}

export function blocksToText(blocks: Block[] | undefined): string {
  return (blocks ?? [])
    .filter((block) => block.type !== "image")
    .map(blockToText)
    .filter((text) => text !== "")
    .join("\n\n");
}

export function imageBlocks(blocks: Block[] | undefined): Extract<Block, { type: "image" }>[] {
  return (blocks ?? []).filter((block): block is Extract<Block, { type: "image" }> => block.type === "image");
}

export function widgetToText(widget: Widget, answer: WidgetAnswer | undefined): string {
  const recorded = formatAnswer(answer);
  const choices = "options" in widget ? ` (${widget.options.join(" / ")})` : "";
  const line = `${widget.prompt}${choices}`;
  return recorded ? `${line}\nAnswer: ${recorded}` : line;
}
