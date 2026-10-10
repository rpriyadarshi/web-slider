/** Padding inside the diagram viewport, matching markdown Mermaid preview whitespace. */
export const MERMAID_PAD = 12;

export function intrinsicSvgSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }
  const attrW = Number.parseFloat(svg.getAttribute("width") ?? "");
  const attrH = Number.parseFloat(svg.getAttribute("height") ?? "");
  if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
    return { width: attrW, height: attrH };
  }
  try {
    const box = svg.getBBox();
    if (box.width > 0 && box.height > 0) return { width: box.width, height: box.height };
  } catch {
    // Not in the DOM yet, or empty.
  }
  return { width: 640, height: 360 };
}

/** Strip Mermaid's fixed pixel sizing so the SVG can be fitted to the slide. */
export function normalizeMermaidSvg(svg: SVGSVGElement): { width: number; height: number } {
  const size = intrinsicSvgSize(svg);
  if (!svg.getAttribute("viewBox")) {
    svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  }
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.style.removeProperty("max-width");
  svg.style.removeProperty("max-height");
  svg.style.removeProperty("width");
  svg.style.removeProperty("height");
  return size;
}

/**
 * How the diagram will land in the slot it was given.
 * textPx is the label size after that fit. readable is false when that size
 * drops below the theme's footer type — the diagram would be an icon.
 */
export function planMermaidFit(
  intrinsic: { width: number; height: number },
  fontPx: number,
  availW: number,
  availH: number,
  minTextPx: number,
  pad: number = MERMAID_PAD,
): { width: number; height: number; textPx: number; readable: boolean } {
  const innerW = Math.max(1, availW - pad * 2);
  const innerH = Math.max(1, availH - pad * 2);
  let width = innerW;
  let height = (intrinsic.height / intrinsic.width) * width;
  if (height > innerH) {
    width = Math.max(1, width * (innerH / height));
    height = innerH;
  }
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  const textPx = fontPx * (width / intrinsic.width);
  return { width, height, textPx, readable: textPx + 0.5 >= minTextPx };
}

/** Smallest explicit label size in the diagram, before it is scaled to the slot. */
export function smallestSvgFontPx(svg: SVGSVGElement): number {
  let min = Infinity;
  for (const el of svg.querySelectorAll("*")) {
    const styled = el instanceof HTMLElement || el instanceof SVGElement ? el.style.fontSize : "";
    const raw = styled || el.getAttribute("font-size") || "";
    const n = Number.parseFloat(raw);
    if (n > 0) min = Math.min(min, n);
  }
  if (Number.isFinite(min)) return min;
  const text = svg.querySelector("text, span, p, .nodeLabel");
  if (text) {
    const n = Number.parseFloat(getComputedStyle(text).fontSize);
    if (n > 0) return n;
  }
  return 16;
}

/** Theme footer type, in the page's own pixels. Diagram labels may not go smaller. */
export function footerTypePx(host: HTMLElement): number {
  const slide = host.closest(".slide");
  const raw = slide ? getComputedStyle(slide).getPropertyValue("--type-footer") : "";
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

/**
 * Fit like markdown Mermaid previews: fill the available width first, then
 * shrink if the scaled height would exceed availH. Grows and shrinks with the window.
 */
export function fitMermaidSvg(
  svg: SVGSVGElement,
  availW: number,
  availH: number,
  pad: number = MERMAID_PAD,
): { width: number; height: number } {
  const size = normalizeMermaidSvg(svg);
  const innerW = Math.max(1, availW - pad * 2);
  const innerH = Math.max(1, availH - pad * 2);
  let width = innerW;
  let height = (size.height / size.width) * width;
  if (height > innerH) {
    const scale = innerH / height;
    width = Math.max(1, width * scale);
    height = innerH;
  }
  width = Math.max(1, Math.round(width));
  height = Math.max(1, Math.round(height));
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;
  svg.style.maxWidth = "none";
  svg.style.maxHeight = "none";
  return { width, height };
}

/**
 * The diagram's box is whatever the slide grid already gave this block.
 * No fraction of the page, no reserve for whatever comes next.
 * If the box has no height yet (side pane, first frame), fit the width and
 * keep a 16:9 envelope until layout assigns a real height.
 */
export function mermaidAvailBox(host: HTMLElement, viewport: HTMLElement = host): { width: number; height: number } {
  const width = Math.max(1, Math.floor(viewport.clientWidth || host.clientWidth || host.getBoundingClientRect().width));
  const height = Math.floor(viewport.clientHeight || host.clientHeight);
  if (width >= 8 && height >= 8) return { width, height };
  return { width: Math.max(96, width), height: Math.max(96, Math.round(Math.max(96, width) * (9 / 16))) };
}
