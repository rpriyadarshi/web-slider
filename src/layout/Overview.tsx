import type { Slide } from "../model/schema";
import { Icon, IconButton, IconMark } from "./IconButton";

export function Overview({
  slides,
  current,
  onJump,
  onClose,
}: {
  slides: Slide[];
  current: number;
  onJump: (index: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="overview" role="dialog" aria-modal="true" aria-label="Slide overview">
      <div className="panel-head">
        <IconMark label="Overview" name="overview" />
        <IconButton label="Hide" onClick={onClose}>
          <Icon name="hide" />
        </IconButton>
      </div>
      <div className="overview-grid">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            aria-current={index === current ? "true" : undefined}
            onClick={() => onJump(index)}
          >
            <span className="num">{index + 1}</span>
            <span>{slide.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
