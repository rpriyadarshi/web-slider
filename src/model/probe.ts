import { isMap, isSeq, parseDocument, type Node } from "yaml";

export type ProbePath = Array<string | number>;

export type ProbeRange = {
  path: ProbePath;
  start: number;
  end: number;
};

export function probeKey(path: ProbePath): string {
  return path.map(String).join("/");
}

export function indexProbes(source: string): ProbeRange[] {
  const doc = parseDocument(source);
  if (!doc.contents) return [];
  const ranges: ProbeRange[] = [];
  walk(doc.contents, [], ranges);
  return ranges;
}

export function locateProbe(source: string, path: ProbePath): { start: number; end: number } | null {
  const key = probeKey(path);
  const found = indexProbes(source).find((range) => probeKey(range.path) === key);
  if (!found) return null;
  return { start: found.start, end: Math.max(found.start, found.end) };
}

export function probeAt(source: string, offset: number): ProbePath | null {
  let best: ProbeRange | null = null;
  for (const range of indexProbes(source)) {
    if (offset < range.start || offset > range.end) continue;
    if (!best || range.path.length >= best.path.length) best = range;
  }
  return best?.path ?? null;
}

export function probeMatches(element: ProbePath, probe: ProbePath | null): boolean {
  if (!probe || probe.length < element.length) return false;
  for (let index = 0; index < element.length; index += 1) {
    if (probe[index] !== element[index]) return false;
  }
  if (probe.length === element.length) return true;
  const rest = probe[element.length];
  return (
    rest === "text" ||
    rest === "title" ||
    rest === "prompt" ||
    rest === "options" ||
    rest === "answer" ||
    rest === "id" ||
    rest === "type" ||
    rest === "takenNotes"
  );
}

export function probeContains(element: ProbePath, probe: ProbePath | null): boolean {
  if (!probe || probe.length <= element.length) return false;
  for (let index = 0; index < element.length; index += 1) {
    if (probe[index] !== element[index]) return false;
  }
  return !probeMatches(element, probe);
}

export function bindProbe(path: ProbePath, probe: ProbePath | null, onProbe?: (path: ProbePath) => void) {
  if (!onProbe) return {};
  return {
    "data-probe": probeKey(path),
    "data-probed": probeMatches(path, probe) ? "true" : undefined,
    "data-probe-ancestor": probeContains(path, probe) ? "true" : undefined,
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation();
      onProbe(path);
    },
  };
}

export function slideIndexInProbe(path: ProbePath | null): number | null {
  if (!path || path[0] !== "slides" || typeof path[1] !== "number") return null;
  return path[1];
}

export function selectionTarget(source: string, path: ProbePath): ProbePath {
  const widgetAt = path.indexOf("widgets");
  if (widgetAt >= 0 && typeof path[widgetAt + 1] === "number") {
    return path.slice(0, widgetAt + 2);
  }
  if (path[0] === "slides" && typeof path[1] === "number" && path[2] === "title") {
    return ["slides", path[1], "title"];
  }
  for (const place of ["blocks", "side"] as const) {
    const at = path.indexOf(place);
    if (at < 0 || typeof path[at + 1] !== "number") continue;
    const blockPath = path.slice(0, at + 2);
    if (path.length > blockPath.length) return path;
    if (nodeField(source, blockPath, "type") === "paragraph") return [...blockPath, "text"];
    return blockPath;
  }
  return path;
}

export function caretSelection(source: string, offset: number): { path: ProbePath; start: number; end: number } | null {
  const path = probeAt(source, offset);
  if (!path) return null;
  const target = selectionTarget(source, path);
  const range = locateProbe(source, target);
  if (!range) return null;
  return { path: target, start: range.start, end: range.end };
}

export function removableNode(path: ProbePath | null): ProbePath | null {
  if (!path || path[0] !== "slides" || typeof path[1] !== "number") return null;
  const widgetAt = path.indexOf("widgets");
  if (widgetAt >= 0 && typeof path[widgetAt + 1] === "number") return path.slice(0, widgetAt + 2);
  for (const place of ["blocks", "side"] as const) {
    const at = path.indexOf(place);
    if (at >= 0 && typeof path[at + 1] === "number") return path.slice(0, at + 2);
  }
  return null;
}

function nodeField(source: string, path: ProbePath, key: string): unknown {
  const doc = parseDocument(source);
  if (doc.errors.length > 0) return undefined;
  const node = doc.getIn(path);
  if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
  return (node as Record<string, unknown>)[key];
}

function nodeRange(value: unknown): [number, number, number] | null {
  if (!value || typeof value !== "object" || !("range" in value)) return null;
  const range = value.range;
  if (!Array.isArray(range) || typeof range[0] !== "number" || typeof range[2] !== "number") return null;
  return range as [number, number, number];
}

function walk(node: Node, path: ProbePath, ranges: ProbeRange[]): void {
  if (isMap(node)) {
    for (const pair of node.items) {
      const name = pair.key && typeof pair.key === "object" && "value" in pair.key ? pair.key.value : null;
      if (typeof name !== "string" && typeof name !== "number") continue;
      const start = nodeRange(pair.key)?.[0];
      const end = nodeRange(pair.value)?.[2];
      if (start === undefined || end === undefined) continue;
      const child = [...path, name];
      ranges.push({ path: child, start, end });
      if (isMap(pair.value) || isSeq(pair.value)) walk(pair.value, child, ranges);
    }
    return;
  }
  if (isSeq(node)) {
    node.items.forEach((item, index) => {
      const range = nodeRange(item);
      if (!range || !item) return;
      const child = [...path, index];
      ranges.push({ path: child, start: range[0], end: range[2] });
      if (isMap(item) || isSeq(item)) walk(item, child, ranges);
    });
  }
}
