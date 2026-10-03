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
  const lineEnd = source.indexOf("\n", found.start);
  const end = lineEnd === -1 ? found.end : Math.min(found.end, lineEnd);
  return { start: found.start, end: Math.max(found.start, end) };
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
