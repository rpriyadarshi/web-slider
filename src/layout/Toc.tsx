import type { Slide } from "../model/schema";
import { Icon, IconButton, IconMark } from "./IconButton";

export function Toc({
  slides,
  current,
  onJump,
  onHide,
}: {
  slides: Slide[];
  current: number;
  onJump: (index: number) => void;
  onHide: () => void;
}) {
  return (
    <nav className="toc" aria-label="Slides">
      <div className="panel-head">
        <IconMark label="Outline" name="outline" />
        <IconButton label="Hide" onClick={onHide}>
          <Icon name="hide" />
        </IconButton>
      </div>
      <ol>
        {slides.map((slide, index) => (
          <li key={slide.id}>
            <button
              type="button"
              className={slide.layout === "section" ? "section" : undefined}
              aria-current={index === current ? "true" : undefined}
              onClick={() => onJump(index)}
            >
              <span className="num">{index + 1}</span>
              <span>{slide.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
