import type { Deck } from "./schema";

export function replaceSlideTitle(deck: Deck, slideId: string, title: string): Deck {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A slide title cannot be empty.");
  const index = deck.slides.findIndex((slide) => slide.id === slideId);
  if (index < 0) throw new Error(`Unknown slide id "${slideId}".`);
  const slides = deck.slides.slice();
  const slide = slides[index];
  if (!slide) throw new Error(`Unknown slide id "${slideId}".`);
  slides[index] = { ...slide, title: trimmed };
  return { ...deck, slides };
}

export function replaceListItem(deck: Deck, slideId: string, blockIndex: number, itemIndex: number, text: string): Deck {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("A list item cannot be empty.");
  const slideIndex = deck.slides.findIndex((slide) => slide.id === slideId);
  const slide = deck.slides[slideIndex];
  if (!slide) throw new Error(`Unknown slide id "${slideId}".`);
  const block = slide.blocks?.[blockIndex];
  if (!block || (block.type !== "bullets" && block.type !== "numbered")) {
    throw new Error("That block is not a list.");
  }
  const item = block.items[itemIndex];
  if (!item) throw new Error("That list item is not on the slide.");
  const items = block.items.slice();
  items[itemIndex] = { ...item, text: trimmed };
  const blocks = slide.blocks?.slice() ?? [];
  blocks[blockIndex] = { ...block, items };
  const slides = deck.slides.slice();
  slides[slideIndex] = { ...slide, blocks };
  return { ...deck, slides };
}
