import type { Slide } from "../model/schema";
import { Icon, IconButton, IconMark } from "./IconButton";

export function Toc({
  slides,
  current,
  pinned,
  onJump,
  onPin,
  onHide,
  className,
}: {
  slides: Slide[];
  current: number;
  pinned: boolean;
  onJump: (index: number) => void;
  onPin: () => void;
  onHide: () => void;
  className: string;
}) {
  return (
    <nav className={className} aria-label="Slides">
      <div className="panel-head">
        <IconMark label="Outline" name="outline" />
        <div className="panel-actions">
          <IconButton label={pinned ? "Unpin" : "Pin"} pressed={pinned} onClick={onPin}>
            <Icon name="pin" />
          </IconButton>
          <IconButton label="Hide" onClick={onHide}>
            <Icon name="hide" />
          </IconButton>
        </div>
      </div>
      <ol>
        {slides.map((slide, index) => (
          <li key={slide.id}>
            <button
              type="button"
              className={[slide.layout === "section" ? "section" : "", slide.hidden ? "hidden-slide" : ""].filter(Boolean).join(" ") || undefined}
              aria-current={index === current ? "true" : undefined}
              onClick={() => onJump(index)}
            >
              <span className="num">{slide.hidden ? "—" : visibleLabel(slides, index)}</span>
              <span>{slide.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function visibleLabel(slides: Slide[], index: number): string {
  let count = 0;
  for (let cursor = 0; cursor <= index; cursor += 1) {
    if (!slides[cursor]?.hidden) count += 1;
  }
  return String(count);
}
