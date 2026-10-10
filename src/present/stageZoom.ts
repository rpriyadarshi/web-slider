/** Discrete zoom levels relative to fit. `1` fits the aspect page in the stage. */
export const STAGE_ZOOM_STEPS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 1.75, 2] as const;

export const STAGE_ZOOM_FIT = 1;
export const STAGE_ZOOM_MIN = STAGE_ZOOM_STEPS[0];
export const STAGE_ZOOM_MAX = STAGE_ZOOM_STEPS[STAGE_ZOOM_STEPS.length - 1];

/**
 * Fixed design size for every slide. Aspect comes from the theme manifest
 * (talk may override). The page does not grow with content.
 */
export function slideReference(aspect: "16:9" | "4:3" = "16:9"): { width: number; height: number } {
  return aspect === "4:3" ? { width: 960, height: 720 } : { width: 960, height: 540 };
}

/** Scale that places the aspect page inside the stage frame. */
export function fitScale(frameW: number, frameH: number, pageW: number, pageH: number): number {
  if (frameW <= 0 || frameH <= 0 || pageW <= 0 || pageH <= 0) return 1;
  return Math.min(frameW / pageW, frameH / pageH);
}

export function viewScale(fit: number, zoom: number): number {
  return fit * zoom;
}

export function nearestZoom(value: number): number {
  let best: number = STAGE_ZOOM_STEPS[0];
  let distance = Math.abs(value - best);
  for (const step of STAGE_ZOOM_STEPS) {
    const next = Math.abs(value - step);
    if (next < distance) {
      best = step;
      distance = next;
    }
  }
  return best;
}

export function zoomIn(current: number): number {
  const from = nearestZoom(current);
  return STAGE_ZOOM_STEPS.find((step) => step > from + 0.001) ?? STAGE_ZOOM_MAX;
}

export function zoomOut(current: number): number {
  const from = nearestZoom(current);
  for (let index = STAGE_ZOOM_STEPS.length - 1; index >= 0; index -= 1) {
    if (STAGE_ZOOM_STEPS[index] < from - 0.001) return STAGE_ZOOM_STEPS[index];
  }
  return STAGE_ZOOM_MIN;
}

export function zoomLabel(zoom: number): string {
  return `${Math.round(nearestZoom(zoom) * 100)}%`;
}
