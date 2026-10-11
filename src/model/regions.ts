/** A box is a percentage of the slide page. x and y are the top-left. */
export type RegionBox = { x: number; y: number; w: number; h: number };

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

/** Autoscale stops here. What still overflows is clipped. */
export const REGION_SCALE_MIN = 0.65;

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

export function resolveLayouts(theme?: { layouts?: Record<string, RegionMap> } | null): Record<string, RegionMap> {
  return { ...DEFAULT_LAYOUTS, ...theme?.layouts };
}

export function layoutNames(theme?: { layouts?: Record<string, RegionMap> } | null): string[] {
  const layouts = resolveLayouts(theme);
  const preferred = ["title", "section", "content", "quote"];
  const rest = Object.keys(layouts)
    .filter((name) => !preferred.includes(name))
    .sort();
  return [...preferred.filter((name) => name in layouts), ...rest];
}

/** The boxes for this slide: the theme layout of the same name. */
export function slideRegions(
  theme: { layouts?: Record<string, RegionMap> } | undefined,
  slide: { layout: string },
): RegionMap {
  const layouts = resolveLayouts(theme);
  return layouts[slide.layout] ?? layouts.content ?? DEFAULT_LAYOUTS.content;
}
