import { parseDocument } from "yaml";

export function writeYamlIn(source: string, path: Array<string | number>, value: unknown): string {
  const doc = parseDocument(source);
  if (doc.errors.length > 0) {
    throw new Error(doc.errors[0]?.message ?? "Invalid YAML");
  }
  if (value === undefined || value === "") doc.deleteIn(path);
  else doc.setIn(path, value);
  return String(doc);
}
