import type { Deck, Slide } from "../model/schema";
import { resolveTheme } from "../model/schema";
import { isRevealed } from "../model/steps";
import { isDarkHex } from "../highlight";
import { Blocks } from "./Blocks";

export function SlideView({ deck, slide, revealed }: { deck: Deck; slide: Slide; revealed: number }) {
  const theme = resolveTheme(deck.theme, slide.theme);
  const quoteCandidate = slide.layout === "quote" ? slide.blocks?.find((block) => block.type === "quote") : undefined;
  const quote = quoteCandidate && isRevealed(quoteCandidate.step, revealed) ? quoteCandidate : undefined;
  const blocks = (slide.blocks ?? []).filter((block) => block !== quote);
  const dark = isDarkHex(theme.background);

  return (
    <article
      className={`slide layout-${slide.layout}`}
      data-align={slide.layout === "content" ? theme.align : "center"}
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
        <Blocks blocks={blocks} revealed={revealed} dark={dark} />
      </div>
    </article>
  );
}
