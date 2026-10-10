import type { RasterImage } from "../export/images";

export type MermaidColors = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  dark: boolean;
};

let ready: Promise<typeof import("mermaid")> | null = null;
let renderCount = 0;

async function loadMermaid(colors: MermaidColors): Promise<typeof import("mermaid")> {
  if (!ready) ready = import("mermaid");
  const mod = await ready;
  // htmlLabels: false keeps labels as SVG <text>. Mermaid's default foreignObject
  // labels taint a canvas in Chromium, so PDF/Word/PowerPoint cannot call toBlob.
  mod.default.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    fontFamily: "Inter, system-ui, sans-serif",
    themeVariables: {
      darkMode: colors.dark,
      background: colors.background,
      primaryColor: colors.surface,
      primaryTextColor: colors.text,
      primaryBorderColor: colors.accent,
      secondaryColor: colors.surface,
      tertiaryColor: colors.background,
      lineColor: colors.muted,
      textColor: colors.text,
      mainBkg: colors.surface,
      nodeBorder: colors.accent,
      clusterBkg: colors.background,
      titleColor: colors.text,
      edgeLabelBackground: colors.background,
      fontFamily: "Inter, system-ui, sans-serif",
    },
    flowchart: { htmlLabels: false, useMaxWidth: true },
    sequence: { useMaxWidth: true },
    htmlLabels: false,
  } as Parameters<typeof mod.default.initialize>[0]);
  return mod;
}

/** SVG markup for the live slide. */
export async function renderMermaidSvg(source: string, colors: MermaidColors): Promise<string> {
  const mod = await loadMermaid(colors);
  renderCount += 1;
  const id = `ws-mermaid-${renderCount}`;
  const { svg } = await mod.default.render(id, source.trim());
  return svg;
}

/** PNG for PDF, Word, and PowerPoint. Needs a browser document. */
export async function rasterizeMermaid(source: string, colors: MermaidColors): Promise<RasterImage> {
  if (typeof document === "undefined") {
    throw new Error("Mermaid diagrams can only be exported in the browser.");
  }
  const svg = await renderMermaidSvg(source, colors);
  const prepared = prepareSvgForCanvas(svg, colors.background);
  const url = svgDataUrl(prepared.markup);
  try {
    const image = new Image();
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The Mermaid diagram could not be drawn."));
        image.src = url;
      });
    } catch {
      throw new Error("The Mermaid diagram could not be drawn.");
    }
    const width = Math.max(1, Math.round(image.naturalWidth || prepared.width));
    const height = Math.max(1, Math.round(image.naturalHeight || prepared.height));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The Mermaid diagram could not be drawn.");
    context.fillStyle = colors.background;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    let png: Blob | null;
    try {
      png = await new Promise<Blob | null>((resolve, reject) => {
        try {
          canvas.toBlob((value) => resolve(value), "image/png");
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Mermaid diagram failed: ${message}`);
    }
    if (!png) throw new Error("The Mermaid diagram could not be drawn.");
    return { bytes: new Uint8Array(await png.arrayBuffer()), mime: "image/png", width, height };
  } finally {
    // data: URLs do not need revoke; keep the finally for symmetry with callers.
  }
}

function prepareSvgForCanvas(svg: string, background: string): { markup: string; width: number; height: number } {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (root.querySelector("parsererror") || root.nodeName.toLowerCase() !== "svg") {
    throw new Error("The Mermaid diagram could not be drawn.");
  }
  // foreignObject taints Chromium canvases. Drop any that slipped through.
  for (const node of [...root.querySelectorAll("foreignObject")]) node.remove();
  if (!root.getAttribute("xmlns")) root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const size = svgSize(root);
  if (!root.getAttribute("width")) root.setAttribute("width", String(size.width));
  if (!root.getAttribute("height")) root.setAttribute("height", String(size.height));
  root.setAttribute("style", `background:${background}`);
  return { markup: new XMLSerializer().serializeToString(root), width: size.width, height: size.height };
}

function svgSize(root: Element): { width: number; height: number } {
  const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (viewBox && viewBox.length === 4 && viewBox.every((value) => Number.isFinite(value))) {
    return { width: Math.max(1, Math.round(viewBox[2]!)), height: Math.max(1, Math.round(viewBox[3]!)) };
  }
  const width = Number.parseFloat(root.getAttribute("width") ?? "");
  const height = Number.parseFloat(root.getAttribute("height") ?? "");
  return {
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : 640,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : 360,
  };
}

function svgDataUrl(markup: string): string {
  // Encode as a utf-8 data URL so the canvas draw is same-origin and untainted.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}
