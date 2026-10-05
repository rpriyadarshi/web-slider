import { tipProps } from "./IconButton";

export function Splitter({
  label,
  axis,
  className,
  onDelta,
}: {
  label: string;
  axis: "x" | "y";
  className?: string;
  onDelta: (delta: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      className={className ? `splitter ${className}` : "splitter"}
      {...tipProps(label, "Drag to resize.")}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);
        let last = axis === "x" ? event.clientX : event.clientY;
        const move = (ev: PointerEvent) => {
          const next = axis === "x" ? ev.clientX : ev.clientY;
          const delta = next - last;
          last = next;
          if (delta !== 0) onDelta(delta);
        };
        const up = (ev: PointerEvent) => {
          if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId);
          handle.removeEventListener("pointermove", move);
          handle.removeEventListener("pointerup", up);
          handle.removeEventListener("pointercancel", up);
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
        handle.addEventListener("pointercancel", up);
      }}
    />
  );
}
