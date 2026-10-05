import { isMap, isSeq, parseDocument, type Node } from "yaml";
import { BLOCK_LABEL, WIDGET_LABEL } from "../model/insert";
import type { ProbePath } from "../model/probe";
import type { Deck } from "../model/schema";
import { revealThresholds } from "../model/steps";
import { blockDoc, deckField, fieldText, slideField, widgetDoc, type FieldDoc } from "./reference";

export type HelpFocus = {
  title: string;
  about: string;
  fields: readonly FieldDoc[];
  example?: string;
  facts: readonly string[];
};

export function helpContext(deck: Deck, probe: ProbePath | null, slideIndex: number): HelpFocus {
  const index = slideIndexIn(probe) ?? slideIndex;
  const slide = deck.slides[index] ?? deck.slides[slideIndex];
  if (!slide) throw new Error("There is no slide to describe.");
  if (!probe) return slideFocus(deck, slideIndex);
  if (probe.length === 1 && typeof probe[0] === "string") {
    const field = deckField(probe[0]);
    if (field) return fieldFocus(field);
  }
  if (probe[0] !== "slides") return slideFocus(deck, index);
  const widgetAt = probe.indexOf("widgets");
  const widgetIndex = widgetAt >= 0 ? probe[widgetAt + 1] : undefined;
  if (typeof widgetIndex === "number") {
    const widget = slide.widgets?.[widgetIndex];
    if (!widget) return slideFocus(deck, index);
    const doc = widgetDoc(widget.type);
    return { title: WIDGET_LABEL[widget.type], about: doc.about, fields: doc.fields, example: doc.example, facts: [`Question: ${widget.prompt}`] };
  }
  for (const place of ["blocks", "side"] as const) {
    const at = probe.indexOf(place);
    const blockIndex = at >= 0 ? probe[at + 1] : undefined;
    if (typeof blockIndex !== "number") continue;
    const block = slide[place]?.[blockIndex];
    if (!block) return slideFocus(deck, index);
    const doc = blockDoc(block.type);
    return {
      title: BLOCK_LABEL[block.type],
      about: doc.about,
      fields: doc.fields,
      example: doc.example,
      facts: [place === "side" ? "Side column." : "Main column."],
    };
  }
  if (typeof probe[2] === "string") {
    const field = slideField(probe[2]);
    if (probe.length === 3 && field) return fieldFocus(field);
    if (probe[2] === "theme" && typeof probe[3] === "string") {
      const nested = slideField("theme")?.fields?.find((item) => item.name === probe[3]);
      if (nested) return fieldFocus(nested);
    }
  }
  return slideFocus(deck, index);
}

function slideIndexIn(probe: ProbePath | null): number | null {
  if (!probe || probe[0] !== "slides" || typeof probe[1] !== "number") return null;
  return probe[1];
}

function slideFocus(deck: Deck, slideIndex: number): HelpFocus {
  const slide = deck.slides[slideIndex];
  if (!slide) throw new Error("There is no slide to describe.");
  const builds = Math.max(0, revealThresholds(slide).length - 1);
  const sideCount = slide.side?.length ?? 0;
  const questions = slide.widgets?.length ?? 0;
  const facts = [
    `Layout: ${slide.layout}.`,
    builds === 0 ? "No builds." : builds === 1 ? "1 build." : `${builds} builds.`,
    sideCount === 0 ? "No side column." : sideCount === 1 ? "1 side block." : `${sideCount} side blocks.`,
    questions === 0 ? "No questions." : questions === 1 ? "1 question." : `${questions} questions.`,
  ];
  if (slide.hidden) facts.push("Hidden. Arrow keys skip it, and exports leave it out.");
  if (slide.autoAdvance) facts.push(`Advances ${slide.autoAdvance} seconds after the last build.`);
  return { title: slide.title, about: "This slide.", fields: [], facts };
}

function fieldFocus(field: FieldDoc): HelpFocus {
  const facts = [field.optional ? "Optional." : "Required."];
  if (field.values && field.values.length > 1) facts.push(`One of: ${field.values.join(", ")}.`);
  return { title: field.name, about: field.about, fields: field.fields ?? [], facts };
}

export function yamlKeyDoc(source: string, offset: number): { from: number; to: number; text: string } | null {
  let doc: ReturnType<typeof parseDocument>;
  try {
    doc = parseDocument(source);
  } catch {
    return null;
  }
  if (!doc.contents) return null;
  const hit = findKey(doc.contents, [], offset);
  if (!hit) return null;
  const field = fieldAt(doc, hit.path);
  if (!field) return null;
  return { from: hit.from, to: hit.to, text: fieldText(field) };
}

function fieldAt(doc: ReturnType<typeof parseDocument>, path: ProbePath): FieldDoc | null {
  if (path.length === 1 && typeof path[0] === "string") return deckField(path[0]);
  if (path[0] !== "slides" || typeof path[1] !== "number" || typeof path[2] !== "string") return null;
  if (path.length === 3) return slideField(path[2]);
  if (path[2] === "theme" && typeof path[3] === "string" && path.length === 4) {
    return slideField("theme")?.fields?.find((field) => field.name === path[3]) ?? null;
  }
  if ((path[2] === "blocks" || path[2] === "side") && typeof path[3] === "number") {
    const type = doc.getIn([path[0], path[1], path[2], path[3], "type"]);
    if (typeof type !== "string") return null;
    let kind;
    try {
      kind = blockDoc(type);
    } catch {
      return null;
    }
    if (path.length === 5 && typeof path[4] === "string") return kind.fields.find((field) => field.name === path[4]) ?? null;
    if (path[4] === "items" && typeof path[5] === "number" && typeof path[6] === "string") {
      return kind.fields.find((field) => field.name === "items")?.fields?.find((field) => field.name === path[6]) ?? null;
    }
  }
  if (path[2] === "widgets" && typeof path[3] === "number" && path.length === 5 && typeof path[4] === "string") {
    const type = doc.getIn([path[0], path[1], "widgets", path[3], "type"]);
    if (typeof type !== "string") return null;
    try {
      return widgetDoc(type).fields.find((field) => field.name === path[4]) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

function findKey(node: Node, path: ProbePath, offset: number): { path: ProbePath; from: number; to: number } | null {
  if (isMap(node)) {
    for (const pair of node.items) {
      const name = pair.key && typeof pair.key === "object" && "value" in pair.key ? pair.key.value : null;
      if (typeof name !== "string") continue;
      const keyRange = nodeRange(pair.key);
      const child = [...path, name];
      if (keyRange && offset >= keyRange[0] && offset <= keyRange[2]) {
        return { path: child, from: keyRange[0], to: keyRange[2] };
      }
      if (pair.value && (isMap(pair.value) || isSeq(pair.value))) {
        const nested = findKey(pair.value, child, offset);
        if (nested) return nested;
      }
    }
    return null;
  }
  if (isSeq(node)) {
    for (let index = 0; index < node.items.length; index += 1) {
      const item = node.items[index];
      if (item && (isMap(item) || isSeq(item))) {
        const nested = findKey(item, [...path, index], offset);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function nodeRange(value: unknown): [number, number, number] | null {
  if (!value || typeof value !== "object" || !("range" in value)) return null;
  const range = value.range;
  if (!Array.isArray(range) || typeof range[0] !== "number" || typeof range[2] !== "number") return null;
  return range as [number, number, number];
}
