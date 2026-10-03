export function blankDeckSource(): string {
  return ["id: deck", "title: Untitled", "slides:", "  - id: slide", "    title: Untitled", "    layout: content", ""].join("\n");
}
