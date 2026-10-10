const STORAGE_KEY = "web-slider.recent.v1";
const MAX = 8;

export type RecentTalk = {
  title: string;
  path: string;
  at: number;
};

function isRecent(value: unknown): value is RecentTalk {
  if (!value || typeof value !== "object") return false;
  const row = value as RecentTalk;
  return typeof row.title === "string" && typeof row.path === "string" && typeof row.at === "number";
}

export function loadRecent(): RecentTalk[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecent).slice(0, MAX);
  } catch {
    return [];
  }
}

/** Remember a catalog example (a path the start screen can open again). */
export function rememberRecent(entry: { title: string; path: string }): void {
  const title = entry.title.trim();
  const path = entry.path.trim();
  if (!title || !path) return;
  const next: RecentTalk[] = [{ title, path, at: Date.now() }, ...loadRecent().filter((row) => row.path !== path)].slice(
    0,
    MAX,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
