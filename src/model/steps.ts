import type { Deck, Slide } from "./schema";

export function revealThresholds(slide: Slide): number[] {
  const steps = new Set<number>();
  for (const block of slide.blocks ?? []) {
    if (block.step && block.step > 0) steps.add(block.step);
    if (block.type === "bullets" || block.type === "numbered") {
      for (const item of block.items) {
        if (item.step && item.step > 0) steps.add(item.step);
      }
    }
  }
  return [0, ...[...steps].sort((left, right) => left - right)];
}

export function isRevealed(step: number | undefined, threshold: number): boolean {
  return (step ?? 0) <= threshold;
}

export function visibleIndexes(deck: Deck): number[] {
  return deck.slides.flatMap((slide, index) => (slide.hidden ? [] : [index]));
}

export function visibleNumber(deck: Deck, slideIndex: number): number | null {
  const place = visibleIndexes(deck).indexOf(slideIndex);
  return place < 0 ? null : place + 1;
}

export function jumpToVisibleNumber(deck: Deck, number: number): { slideIndex: number; revealed: number } | null {
  const target = visibleIndexes(deck)[number - 1];
  if (target === undefined) return null;
  return jumpTo(deck, target);
}

function neighborVisible(deck: Deck, start: number, direction: 1 | -1): number | null {
  for (let index = start; index >= 0 && index < deck.slides.length; index += direction) {
    if (!deck.slides[index]?.hidden) return index;
  }
  return null;
}

export function moveForward(deck: Deck, slideIndex: number, revealed: number): { slideIndex: number; revealed: number } {
  const slide = deck.slides[slideIndex];
  const thresholds = revealThresholds(slide);
  const position = Math.max(0, thresholds.lastIndexOf(revealed));
  if (position < thresholds.length - 1) {
    return { slideIndex, revealed: thresholds[position + 1] };
  }
  const next = neighborVisible(deck, slideIndex + 1, 1);
  if (next === null) return { slideIndex, revealed };
  return { slideIndex: next, revealed: 0 };
}

export function moveBack(deck: Deck, slideIndex: number, revealed: number): { slideIndex: number; revealed: number } {
  const slide = deck.slides[slideIndex];
  const thresholds = revealThresholds(slide);
  const position = Math.max(0, thresholds.indexOf(revealed));
  if (position > 0) {
    return { slideIndex, revealed: thresholds[position - 1] };
  }
  const previous = neighborVisible(deck, slideIndex - 1, -1);
  if (previous === null) return { slideIndex, revealed };
  const previousThresholds = revealThresholds(deck.slides[previous]);
  return { slideIndex: previous, revealed: previousThresholds[previousThresholds.length - 1] };
}

export function jumpTo(deck: Deck, slideIndex: number): { slideIndex: number; revealed: number } {
  const slide = deck.slides[slideIndex];
  const thresholds = revealThresholds(slide);
  return { slideIndex, revealed: thresholds[thresholds.length - 1] };
}
