import YAML from "js-yaml";
import type { Deck, Widget } from "./schema";
import type { DeckSession, WidgetAnswer } from "./session";

function defined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function withSessionAnswer(widget: Widget, answer: WidgetAnswer | undefined): Widget {
  if (answer === undefined) {
    const rest = { ...widget };
    delete rest.answer;
    return rest;
  }
  return { ...widget, answer } as Widget;
}

export function serializeDeck(deck: Deck, session: DeckSession): string {
  const slides = deck.slides.map((slide) => {
    const takenNotes = session.notes[slide.id];
    const widgets = slide.widgets?.map((widget) => withSessionAnswer(widget, session.answers[slide.id]?.[widget.id]));
    return defined({
      id: slide.id,
      title: slide.title,
      layout: slide.layout,
      subtitle: slide.subtitle,
      hidden: slide.hidden ? true : undefined,
      autoAdvance: slide.autoAdvance,
      notes: slide.notes,
      takenNotes: takenNotes ? takenNotes : undefined,
      theme: slide.theme,
      blocks: slide.blocks,
      side: slide.side,
      widgets,
    });
  });

  const document = defined({
    id: deck.id,
    title: deck.title,
    author: deck.author,
    footer: deck.footer,
    showSlideNumber: deck.showSlideNumber,
    aspect: deck.aspect,
    brand: deck.brand,
    theme: deck.theme,
    slides,
  });

  return YAML.dump(document, { lineWidth: -1, noRefs: true });
}
