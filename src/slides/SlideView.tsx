import { BrandLockup, resolveBrand } from "../brand/kit";
import type { Deck, Slide } from "../model/schema";
import { resolveTheme } from "../model/schema";
import { isRevealed, visibleIndexes, visibleNumber } from "../model/steps";
import { isDarkHex } from "../highlight";
import { Blocks } from "./Blocks";

export function SlideView({
  deck,
  slide,
  revealed,
  onOpenSlide,
  laser,
  caption,
  onLaserMove,
}: {
  deck: Deck;
  slide: Slide;
  revealed: number;
  onOpenSlide?: (slideId: string) => void;
  laser?: { x: number; y: number } | null;
  caption?: string;
  onLaserMove?: (point: { x: number; y: number }) => void;
}) {
  const theme = resolveTheme(deck.theme, slide.theme);
  const brand = resolveBrand(deck.brand);
  const quoteCandidate = slide.layout === "quote" ? slide.blocks?.find((block) => block.type === "quote") : undefined;
  const quote = quoteCandidate && isRevealed(quoteCandidate.step, revealed) ? quoteCandidate : undefined;
  const blocks = (slide.blocks ?? []).filter((block) => block !== quote);
  const dark = isDarkHex(theme.background);

  return (
    <article
      className={`slide layout-${slide.layout}`}
      data-align={slide.layout === "content" ? theme.align : "center"}
      data-aspect={deck.aspect ?? "16:9"}
      onPointerMove={
        onLaserMove
          ? (event) => {
              const box = event.currentTarget.getBoundingClientRect();
              if (box.width === 0 || box.height === 0) return;
              onLaserMove({
                x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
                y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
              });
            }
          : undefined
      }
      style={{
        background: theme.background,
        color: theme.text,
        ["--slide-surface" as string]: theme.surface,
        ["--slide-text" as string]: theme.text,
        ["--slide-muted" as string]: theme.muted,
        ["--slide-accent" as string]: theme.accent,
        ["--slide-heading" as string]: `"${theme.fontHeading}"`,
        ["--slide-body" as string]: `"${theme.fontBody}"`,
        ["--slide-mono" as string]: `"${theme.fontMono}"`,
        ["--slide-radius" as string]: `${theme.radius}px`,
        ["--heading-scale" as string]: String(theme.headingScale),
        ["--type-title" as string]: `${theme.type.title}px`,
        ["--type-section" as string]: `${theme.type.section}px`,
        ["--type-slide" as string]: `${theme.type.slide}px`,
        ["--type-body" as string]: `${theme.type.body}px`,
        ["--type-sub" as string]: `${theme.type.sub}px`,
        ["--type-author" as string]: `${theme.type.author}px`,
        ["--type-table" as string]: `${theme.type.table}px`,
        ["--type-footer" as string]: `${theme.type.footer}px`,
        ["--type-wordmark" as string]: `${theme.type.wordmark}px`,
        ["--type-mark" as string]: `${theme.type.mark}px`,
        ["--type-caption" as string]: `${theme.type.caption}px`,
        ...(brand ? { ["--highlight" as string]: brand.highlight } : {}),
      }}
    >
      <div className="slide-copy" key={slide.id}>
        <h1 className="slide-title">{slide.title}</h1>
        {slide.subtitle ? <p className="slide-sub">{slide.subtitle}</p> : null}
        {slide.layout === "title" && deck.author ? <p className="slide-author">{deck.author}</p> : null}
        {quote && quote.type === "quote" ? (
          <blockquote className="pull-quote">
            <p>{quote.text}</p>
            {quote.attribution ? <footer>{quote.attribution}</footer> : null}
          </blockquote>
        ) : null}
        <Blocks blocks={blocks} revealed={revealed} dark={dark} onOpenSlide={onOpenSlide} />
      </div>
      {caption ? <p className="captions">{caption}</p> : null}
      {laser ? <span className="laser" style={{ left: `${laser.x * 100}%`, top: `${laser.y * 100}%` }} /> : null}
      <footer className="slide-footer">
        <span className="slide-brand">
          {brand ? <BrandLockup brand={brand} mode={dark ? "dark" : "light"} /> : null}
          {deck.footer ? <span>{deck.footer}</span> : null}
        </span>
        {deck.showSlideNumber === false ? null : (
          <span>
            {visibleNumber(deck, deck.slides.indexOf(slide)) ?? ""} / {visibleIndexes(deck).length}
          </span>
        )}
      </footer>
    </article>
  );
}
