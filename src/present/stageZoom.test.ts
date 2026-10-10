import { describe, expect, it } from "vitest";
import {
  STAGE_ZOOM_FIT,
  STAGE_ZOOM_MAX,
  STAGE_ZOOM_MIN,
  fitScale,
  nearestZoom,
  slideReference,
  viewScale,
  zoomIn,
  zoomLabel,
  zoomOut,
} from "./stageZoom";

describe("stageZoom", () => {
  it("steps up and down within the range", () => {
    expect(zoomOut(STAGE_ZOOM_FIT)).toBeLessThan(STAGE_ZOOM_FIT);
    expect(zoomIn(STAGE_ZOOM_FIT)).toBeGreaterThan(STAGE_ZOOM_FIT);
    expect(zoomIn(STAGE_ZOOM_MAX)).toBe(STAGE_ZOOM_MAX);
    expect(zoomOut(STAGE_ZOOM_MIN)).toBe(STAGE_ZOOM_MIN);
  });

  it("fits at 100%", () => {
    expect(STAGE_ZOOM_FIT).toBe(1);
    expect(zoomLabel(STAGE_ZOOM_FIT)).toBe("100%");
    expect(nearestZoom(1.02)).toBe(1);
  });

  it("scales the fixed aspect page into the stage frame", () => {
    expect(slideReference("16:9")).toEqual({ width: 960, height: 540 });
    expect(slideReference("4:3")).toEqual({ width: 960, height: 720 });
    expect(fitScale(1920, 1080, 960, 540)).toBe(2);
    expect(fitScale(800, 1000, 960, 540)).toBeCloseTo(800 / 960);
    expect(viewScale(0.5, 2)).toBe(1);
  });
});
