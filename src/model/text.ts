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
    case "numbered":
      return block.items.map((item, index) => `${index + 1}. ${item.text}`).join("\n");
    case "table":
      return [block.headers.join(" | "), ...block.rows.map((row) => row.join(" | "))].join("\n");
    case "link":
      return block.href ? `${block.text} (${block.href})` : block.text;
    case "video":
      return block.title ? `[Video] ${block.title} (${block.src})` : `[Video] ${block.src}`;
    case "chart":
      return [
        block.kind === "bar" ? "Bar chart" : "Column chart",
        ...block.labels.map((label, index) => `${label}: ${block.values[index]}`),
      ].join("\n");
    case "mermaid":
      return block.caption ? `[Diagram: ${block.caption}]` : "[Diagram]";
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
    .filter((block) => block.type !== "image" && block.type !== "mermaid")
    .map(blockToText)
    .filter((text) => text !== "")
    .join("\n\n");
}

export function imageBlocks(blocks: Block[] | undefined): Extract<Block, { type: "image" }>[] {
  return (blocks ?? []).filter((block): block is Extract<Block, { type: "image" }> => block.type === "image");
}

export function mermaidBlocks(blocks: Block[] | undefined): Extract<Block, { type: "mermaid" }>[] {
  return (blocks ?? []).filter((block): block is Extract<Block, { type: "mermaid" }> => block.type === "mermaid");
}

export function widgetToText(widget: Widget, answer: WidgetAnswer | undefined): string {
  const recorded = formatAnswer(answer);
  const choices = "options" in widget ? ` (${widget.options.join(" / ")})` : "";
  const line = `${widget.prompt}${choices}`;
  return recorded ? `${line}\nAnswer: ${recorded}` : line;
}
