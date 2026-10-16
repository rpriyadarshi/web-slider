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
  tableRow,
  tableCol,
  emphasis,
  comparison,
  arrow,
  media,
  children,
}: {
  name: string;
  box: RegionBox;
  align: "left" | "center";
  className?: string;
  tableRow?: number;
  tableCol?: number;
  emphasis?: boolean;
  comparison?: boolean;
  arrow?: boolean;
  media?: boolean;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const fit = fitRef.current;
    if (!frame || !fit) return;

    const apply = () => {
      const padOf = () => {
        const style = getComputedStyle(fit);
        return (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
      };
      const available = frame.clientHeight;
      if (!(available > 0)) return;
      frame.style.setProperty("--region-scale", "1");
      let pad = padOf();
      let next = regionScale(neededHeight(fit) + pad, available);
      frame.style.setProperty("--region-scale", String(next));
      for (let pass = 0; pass < 4 && next > REGION_SCALE_MIN; pass += 1) {
        pad = padOf();
        const needed = neededHeight(fit);
        if (needed + pad <= available + 4) break;
        const room = Math.max(1, available - pad);
        const corrected = Math.max(REGION_SCALE_MIN, Math.round(next * (room / needed) * 1000) / 1000);
        if (corrected >= next) break;
        next = corrected;
        frame.style.setProperty("--region-scale", String(next));
      }
      frame.dataset.regionScale = String(next);
      const row = frame.dataset.tableRow;
      if (row == null) return;
      const peers = [...(frame.parentElement?.querySelectorAll<HTMLElement>(`:scope > .region[data-table-row="${row}"]`) ?? [])];
      if (peers.length < 2) return;
      const scale = Math.min(...peers.map((peer) => Number(peer.dataset.regionScale) || 1));
      for (const peer of peers) {
        peer.style.setProperty("--region-scale", String(scale));
        peer.dataset.regionScale = String(scale);
      }
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
      data-table-row={tableRow}
      data-table-col={tableCol}
      data-emphasis={emphasis ? "recommended" : undefined}
      data-table={comparison ? "comparison" : undefined}
      data-tone={box.tone}
      data-ground={box.ground ? "true" : undefined}
      data-shape={box.shape}
      data-faint={box.faint ? "true" : undefined}
      data-ink={box.ink}
      data-anchor={box.anchor}
      data-arrow={arrow ? "true" : undefined}
      data-media={media ? "true" : undefined}
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
        ...(box.size ? { ["--source-size" as string]: `${box.size}px` } : {}),
      }}
      data-size={box.size ? "true" : undefined}
    >
      <div ref={fitRef} className="region-fit">
        {children}
      </div>
    </div>
  );
}
