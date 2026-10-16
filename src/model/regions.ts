/** A box is a percentage of the slide page. x and y are the top-left. */
export type RegionBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: "inverse" | "accent" | "highlight" | "deep" | "wash" | "band";
  /** A fill drawn behind other regions. It may overlap them. */
  ground?: boolean;
  /** Corner of a ground. Omitted means square. */
  shape?: "round" | "circle" | "rule";
  /** A translucent fill. The solid shapes on top of it stay the mark. */
  faint?: boolean;
  /** Type color for text that sits on a ground. The region itself stays clear. */
  ink?: "inverse" | "accent" | "highlight" | "deep";
  anchor?: "middle";
  align?: "center";
  /** Source type size in points. One point is one pixel on the 960-wide page. */
  size?: number;
};

/** Named boxes for one slide. Keys are region names such as title, body, and footer. */
export type RegionMap = Record<string, RegionBox>;

/** Layouts the presenter uses when a theme does not name its own. */
export const DEFAULT_LAYOUTS: Record<string, RegionMap> = {
  title: {
    title: { x: 8, y: 22, w: 84, h: 16 },
    subtitle: { x: 8, y: 40, w: 84, h: 10 },
    author: { x: 8, y: 52, w: 84, h: 8 },
    footer: { x: 6, y: 88, w: 88, h: 8 },
  },
  section: {
    title: { x: 8, y: 36, w: 84, h: 16 },
    footer: { x: 6, y: 88, w: 88, h: 8 },
  },
  content: {
    title: { x: 6, y: 5, w: 88, h: 14 },
    body: { x: 6, y: 20, w: 88, h: 66 },
    footer: { x: 6, y: 88, w: 88, h: 8 },
  },
  quote: {
    body: { x: 10, y: 24, w: 80, h: 52 },
    footer: { x: 6, y: 88, w: 88, h: 8 },
  },
};

/** Autoscale stops here. Below this, the type would be unreadably small. */
export const REGION_SCALE_MIN = 0.15;

export function boxesOverlap(a: RegionBox, b: RegionBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Scale that fits `needed` into `available`. Starts at 1 and only goes down,
 * and never below REGION_SCALE_MIN. A few pixels of slack stays at 1.
 */
export function regionScale(needed: number, available: number): number {
  if (!(available > 0)) return 1;
  if (needed <= available + 4) return 1;
  const next = Math.round((available / needed) * 1000) / 1000;
  return Math.max(REGION_SCALE_MIN, next);
}

/** These names are slide fields. Any other region on a layout is a slot. */
export const FIELD_REGIONS = ["title", "subtitle", "author", "footer", "body", "side"] as const;

export function resolveLayouts(
  theme?: { layouts?: Record<string, RegionMap> } | null,
  deck?: { layouts?: Record<string, RegionMap> } | null,
): Record<string, RegionMap> {
  return { ...DEFAULT_LAYOUTS, ...theme?.layouts, ...deck?.layouts };
}

export function layoutNames(
  theme?: { layouts?: Record<string, RegionMap> } | null,
  deck?: { layouts?: Record<string, RegionMap> } | null,
): string[] {
  const layouts = resolveLayouts(theme, deck);
  const preferred = ["title", "section", "content", "quote"];
  const rest = Object.keys(layouts)
    .filter((name) => !preferred.includes(name))
    .sort();
  return [...preferred.filter((name) => name in layouts), ...rest];
}

export type TableCell = {
  row: number;
  col: number;
  emphasis: boolean;
  comparison: boolean;
};

/** A short shout, such as OPTION A or WHAT IT IS, is a column label rather than a sentence. */
export function isColumnLabel(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters.length <= 32 && letters === letters.toUpperCase();
}

/**
 * Slot boxes that line up in columns. A row shares one type size.
 * A grid whose cells include column labels is a comparison table.
 */
export function tableCells(regions: RegionMap, texts: (name: string) => string[]): Record<string, TableCell> {
  const names = Object.keys(regions).filter((name) => {
    if ((FIELD_REGIONS as readonly string[]).includes(name) || regions[name]?.ground) return false;
    const lines = texts(name);
    return !(lines.length > 0 && lines.every((text) => /^[→←↑↓↔]+$/.test(text.trim())));
  });
  const items = names.flatMap((name) => {
    const box = regions[name];
    return box ? [{ name, box }] : [];
  });
  const parent = items.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index] ?? index)));
  const sameRow = (left: RegionBox, right: RegionBox) => {
    if (Boolean(left.tone || left.ink) !== Boolean(right.tone || right.ink)) return false;
    const overlap = Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
    return overlap > Math.min(left.h, right.h) * 0.45;
  };
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left && right && sameRow(left.box, right.box)) parent[find(j)] = find(i);
    }
  }
  const grouped = new Map<number, typeof items>();
  items.forEach((item, index) => {
    const key = find(index);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  });
  const rows = [...grouped.values()].filter((row) => row.length >= 2).sort((left, right) => (left[0]?.box.y ?? 0) - (right[0]?.box.y ?? 0));
  if (rows.length === 0) return {};
  const emphasis = new Set<number>();
  const places: Record<string, TableCell> = {};
  rows.forEach((row, rowIndex) => {
    [...row]
      .sort((left, right) => left.box.x - right.box.x)
      .forEach((item, col) => {
        if (texts(item.name).some((text) => /recommended/i.test(text))) emphasis.add(col);
        places[item.name] = { row: rowIndex, col, emphasis: false, comparison: false };
      });
  });
  const similar = rows.every((row) => {
    const widths = row.map((item) => item.box.w);
    const narrow = Math.min(...widths);
    const wide = Math.max(...widths);
    return narrow > 0 && wide <= narrow * 1.45;
  });
  const comparison = similar && Object.keys(places).some((name) => texts(name).some((text) => isColumnLabel(text)));
  for (const place of Object.values(places)) {
    place.emphasis = emphasis.has(place.col);
    place.comparison = comparison;
  }
  return places;
}

/** Theme layouts, then the talk's layouts. A name on the talk replaces that theme layout. */
export function slideRegions(
  theme: { layouts?: Record<string, RegionMap> } | undefined,
  slide: { layout: string },
  deck?: { layouts?: Record<string, RegionMap> } | null,
): RegionMap {
  const layouts = resolveLayouts(theme, deck);
  return layouts[slide.layout] ?? layouts.content ?? DEFAULT_LAYOUTS.content;
}
