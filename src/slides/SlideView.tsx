import { BrandLockup, resolveBrand, withAssetUrls } from "../brand/kit";
import type { Deck, Slide } from "../model/schema";
import { resolveTheme } from "../model/schema";
import { slideRegions } from "../model/regions";
import { isRevealed, visibleIndexes, visibleNumber } from "../model/steps";
import { isDarkHex } from "../highlight";
import { bindProbe, type ProbePath } from "../model/probe";
import { Blocks, EditableText } from "./Blocks";
import { Region } from "./Region";

export function SlideView({
  deck,
  slide,
  revealed,
  onOpenSlide,
  laser,
  caption,
  onLaserMove,
  onEditTitle,
  onEditItem,
  slideIndex = 0,
  probe = null,
  onProbe,
  assets,
}: {
  deck: Deck;
  slide: Slide;
  revealed: number;
  onOpenSlide?: (slideId: string) => void;
  laser?: { x: number; y: number } | null;
  caption?: string;
  onLaserMove?: (point: { x: number; y: number }) => void;
  onEditTitle?: (title: string) => void;
  onEditItem?: (blockIndex: number, itemIndex: number, text: string) => void;
  slideIndex?: number;
  probe?: ProbePath | null;
  onProbe?: (path: ProbePath) => void;
  assets?: Map<string, string>;
}) {
  const theme = resolveTheme(deck.theme, slide.theme);
  const brand = withAssetUrls(resolveBrand(deck.brand), assets);
  const quoteCandidate = slide.layout === "quote" ? slide.blocks?.find((block) => block.type === "quote") : undefined;
  const quote = quoteCandidate && isRevealed(quoteCandidate.step, revealed) ? quoteCandidate : undefined;
  const dark = isDarkHex(theme.background);
  const regions = slideRegions(deck.theme, slide);
  const layoutClass = slide.layout === "title" || slide.layout === "section" || slide.layout === "quote" ? slide.layout : "content";
  const align = layoutClass === "content" ? theme.align : "center";
  const titleInBody = !regions.title;

  return (
    <article
      className={`slide layout-${layoutClass}`}
      data-layout={slide.layout}
      data-align={align}
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
        ["--slide-bg" as string]: theme.background,
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
      {regions.title ? (
        <Region name="title" box={regions.title} align={align}>
          <h1 className="slide-title" {...bindProbe(["slides", slideIndex, "title"], probe, onProbe)}>
            <EditableText
              text={slide.title}
              onSelect={onProbe ? () => onProbe(["slides", slideIndex, "title"]) : undefined}
              onCommit={onEditTitle}
            />
          </h1>
          {!regions.subtitle && slide.subtitle ? (
            <p className="slide-sub" {...bindProbe(["slides", slideIndex, "subtitle"], probe, onProbe)}>
              {slide.subtitle}
            </p>
          ) : null}
          {!regions.author && slide.layout === "title" && deck.author ? (
            <p className="slide-author" {...bindProbe(["author"], probe, onProbe)}>
              {deck.author}
            </p>
          ) : null}
        </Region>
      ) : null}
      {regions.subtitle && slide.subtitle ? (
        <Region name="subtitle" box={regions.subtitle} align={align}>
          <p className="slide-sub" {...bindProbe(["slides", slideIndex, "subtitle"], probe, onProbe)}>
            {slide.subtitle}
          </p>
        </Region>
      ) : null}
      {regions.author && slide.layout === "title" && deck.author ? (
        <Region name="author" box={regions.author} align={align}>
          <p className="slide-author" {...bindProbe(["author"], probe, onProbe)}>
            {deck.author}
          </p>
        </Region>
      ) : null}
      {regions.body ? (
        <Region name="body" box={regions.body} align={align}>
          {titleInBody ? (
            <h1 className="slide-title" {...bindProbe(["slides", slideIndex, "title"], probe, onProbe)}>
              <EditableText
                text={slide.title}
                onSelect={onProbe ? () => onProbe(["slides", slideIndex, "title"]) : undefined}
                onCommit={onEditTitle}
              />
            </h1>
          ) : null}
          {quote && quote.type === "quote" ? (
            <blockquote
              className="pull-quote"
              {...bindProbe(["slides", slideIndex, "blocks", slide.blocks?.indexOf(quote) ?? 0], probe, onProbe)}
            >
              <p>{quote.text}</p>
              {quote.attribution ? <footer>{quote.attribution}</footer> : null}
            </blockquote>
          ) : null}
          <Blocks
            blocks={slide.blocks}
            skip={quote}
            revealed={revealed}
            dark={dark}
            onOpenSlide={onOpenSlide}
            onEditItem={onEditItem}
            slideIndex={slideIndex}
            probe={probe}
            onProbe={onProbe}
          />
          {caption ? <p className="captions">{caption}</p> : null}
        </Region>
      ) : null}
      {regions.side && slide.side?.length ? (
        <Region name="side" box={regions.side} align={layoutClass === "content" ? theme.align : "left"}>
          <Blocks blocks={slide.side} revealed={revealed} dark={dark} onOpenSlide={onOpenSlide} slideIndex={slideIndex} />
        </Region>
      ) : null}
      {laser ? <span className="laser" style={{ left: `${laser.x * 100}%`, top: `${laser.y * 100}%` }} /> : null}
      {regions.footer ? (
        <Region name="footer" box={regions.footer} align="left" className="slide-footer">
          <span className="slide-brand">
            {brand ? <BrandLockup brand={brand} mode={dark ? "dark" : "light"} /> : null}
            {deck.footer ? <span {...bindProbe(["footer"], probe, onProbe)}>{deck.footer}</span> : null}
          </span>
          {deck.showSlideNumber === false ? null : (
            <span>
              {visibleNumber(deck, deck.slides.indexOf(slide)) ?? ""} / {visibleIndexes(deck).length}
            </span>
          )}
        </Region>
      ) : null}
    </article>
  );
}
