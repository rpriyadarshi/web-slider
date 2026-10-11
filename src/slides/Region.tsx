import { useLayoutEffect, useRef, type ReactNode } from "react";
import { REGION_SCALE_MIN, regionScale, type RegionBox } from "../model/regions";

function outerHeight(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return el.offsetHeight + (Number.parseFloat(style.marginTop) || 0) + (Number.parseFloat(style.marginBottom) || 0);
}

/** Height the children need, walking columns. A graphic counts as the space it already occupies. */
function neededHeight(parent: HTMLElement): number {
  const style = getComputedStyle(parent);
  const row = style.flexDirection === "row" || style.flexDirection === "row-reverse";
  const gap = Number.parseFloat(style.rowGap || "0") || Number.parseFloat(style.gap || "0") || 0;
  const kids = [...parent.children].filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (row) return kids.reduce((max, kid) => Math.max(max, outerHeight(kid)), 0);
  return kids.reduce((total, kid, index) => {
    const inner = kid.classList.contains("blocks") ? neededHeight(kid) : outerHeight(kid);
    return total + inner + (index > 0 ? gap : 0);
  }, 0);
}

export function Region({
  name,
  box,
  align,
  className,
  children,
}: {
  name: string;
  box: RegionBox;
  align: "left" | "center";
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const fit = fitRef.current;
    if (!frame || !fit) return;

    const apply = () => {
      const available = frame.clientHeight;
      if (!(available > 0)) return;
      frame.style.setProperty("--region-scale", "1");
      let next = regionScale(neededHeight(fit), available);
      frame.style.setProperty("--region-scale", String(next));
      if (next < 1) {
        const needed = neededHeight(fit);
        if (needed > available + 4) {
          next = Math.max(REGION_SCALE_MIN, Math.round(next * (available / needed) * 1000) / 1000);
          frame.style.setProperty("--region-scale", String(next));
        }
      }
      frame.dataset.regionScale = String(next);
    };

    apply();
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      apply();
      observer.observe(frame);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  });

  return (
    <div
      ref={frameRef}
      className={className ? `region ${className}` : "region"}
      data-region={name}
      data-align={align}
      style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
    >
      <div ref={fitRef} className="region-fit">
        {children}
      </div>
    </div>
  );
}
