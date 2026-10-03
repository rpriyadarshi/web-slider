import { isSeq, parseDocument, type Document } from "yaml";

function openDocument(source: string): Document {
  const doc = parseDocument(source);
  if (doc.errors.length > 0) {
    throw new Error(doc.errors[0]?.message ?? "Invalid YAML");
  }
  if (!doc.contents) throw new Error("Deck YAML is empty.");
  return doc;
}

export function writeYamlIn(source: string, path: Array<string | number>, value: unknown): string {
  const doc = openDocument(source);
  if (value === undefined || value === "") doc.deleteIn(path);
  else doc.setIn(path, value);
  return String(doc);
}

export function insertYamlAt(source: string, path: Array<string | number>, index: number, value: unknown): string {
  const doc = openDocument(source);
  let seq = doc.getIn(path, true);
  if (seq === undefined) {
    doc.setIn(path, doc.createNode([]));
    seq = doc.getIn(path, true);
  }
  if (!isSeq(seq)) throw new Error(`Expected a list at ${path.join(".")}.`);
  if (!Number.isInteger(index) || index < 0 || index > seq.items.length) {
    throw new Error(`Insert index ${String(index)} is outside the list.`);
  }
  seq.items.splice(index, 0, doc.createNode(value));
  return String(doc);
}

export function deleteYamlIn(source: string, path: Array<string | number>): string {
  const doc = openDocument(source);
  const removed = doc.deleteIn(path);
  if (!removed) throw new Error(`Nothing to remove at ${path.join(".")}.`);
  return String(doc);
}
