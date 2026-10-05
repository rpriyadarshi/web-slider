import type { Slide } from "../model/schema";
import { control } from "../help/controls";
import { hideTip } from "../help/tips";
import { shortcutCaps } from "../help/keys";
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
        <IconMark label="Overview" name="overview" tip={control("overview").about} />
        <IconButton label="Hide" tip={hideTip("Overview")} keys={shortcutCaps("overview")} onClick={onClose}>
          <Icon name="hide" />
        </IconButton>
      </div>
      <div className="overview-grid">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            className={slide.hidden ? "hidden-slide" : undefined}
            aria-current={index === current ? "true" : undefined}
            onClick={() => onJump(index)}
          >
            <span className="num">{slide.hidden ? "—" : visibleLabel(slides, index)}</span>
            <span>{slide.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function visibleLabel(slides: Slide[], index: number): string {
  let count = 0;
  for (let cursor = 0; cursor <= index; cursor += 1) {
    if (!slides[cursor]?.hidden) count += 1;
  }
  return String(count);
}
