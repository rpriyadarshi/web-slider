import { describe, expect, it } from "vitest";
import { fitMermaidSvg, intrinsicSvgSize, MERMAID_PAD, mermaidAvailBox, normalizeMermaidSvg, planMermaidFit } from "./fit";

function mockSvg(width: number, height: number, extras: { maxWidth?: string; widthAttr?: string; heightAttr?: string } = {}) {
  const attrs = new Map<string, string>([["viewBox", `0 0 ${width} ${height}`]]);
  if (extras.widthAttr) attrs.set("width", extras.widthAttr);
  if (extras.heightAttr) attrs.set("height", extras.heightAttr);
  const style: Record<string, string> & { removeProperty: (name: string) => void } = {
    maxWidth: extras.maxWidth ?? "",
    maxHeight: "",
    width: "",
    height: "",
    removeProperty(name: string) {
      const key = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      this[key] = "";
    },
  };
  return {
    viewBox: { baseVal: { width, height, x: 0, y: 0 } },
    getAttribute: (key: string) => attrs.get(key) ?? null,
    setAttribute: (key: string, value: string) => {
      attrs.set(key, value);
    },
    removeAttribute: (key: string) => {
      attrs.delete(key);
    },
    style,
    getBBox: () => ({ width, height, x: 0, y: 0 }),
  } as unknown as SVGSVGElement;
}

describe("mermaid fit", () => {
  it("reads intrinsic size from viewBox", () => {
    expect(intrinsicSvgSize(mockSvg(400, 200))).toEqual({ width: 400, height: 200 });
  });

  it("strips Mermaid fixed sizing and keeps viewBox", () => {
    const svg = mockSvg(400, 200, { maxWidth: "400px", widthAttr: "100%", heightAttr: "100%" });
    const size = normalizeMermaidSvg(svg);
    expect(size).toEqual({ width: 400, height: 200 });
    expect(svg.getAttribute("width")).toBeNull();
    expect(svg.getAttribute("height")).toBeNull();
    expect(svg.style.maxWidth).toBe("");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  it("fills width first in a large presentation window", () => {
    const svg = mockSvg(200, 100);
    const fitted = fitMermaidSvg(svg, 640, 360, MERMAID_PAD);
    // Inner width 616; height follows aspect 308, under the 336 inner height cap.
    expect(fitted.width).toBe(616);
    expect(fitted.height).toBe(308);
  });

  it("shrinks when width-first height would exceed the envelope", () => {
    const svg = mockSvg(800, 400);
    const fitted = fitMermaidSvg(svg, 200, 120, 10);
    expect(fitted.width).toBe(180);
    expect(fitted.height).toBe(90);
  });

  it("uses the box layout already assigned, not a fraction of the page", () => {
    const viewport = {
      clientWidth: 640,
      clientHeight: 180,
      getBoundingClientRect: () => ({ width: 640, height: 180 }),
    } as HTMLElement;
    expect(mermaidAvailBox(viewport, viewport)).toEqual({ width: 640, height: 180 });
  });

  it("keeps a 16:9 envelope when the slot has no height yet", () => {
    const viewport = {
      clientWidth: 320,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: 320, height: 0 }),
    } as HTMLElement;
    expect(mermaidAvailBox(viewport, viewport)).toEqual({ width: 320, height: 180 });
  });

  it("rejects a diagram whose labels would shrink below the footer type", () => {
    const tight = planMermaidFit({ width: 800, height: 500 }, 16, 700, 120, 14);
    expect(tight.readable).toBe(false);
    expect(tight.textPx).toBeLessThan(14);
  });

  it("keeps a diagram whose labels stay at the footer type", () => {
    const open = planMermaidFit({ width: 800, height: 400 }, 16, 760, 420, 14);
    expect(open.readable).toBe(true);
    expect(open.textPx).toBeGreaterThanOrEqual(14);
  });
});
