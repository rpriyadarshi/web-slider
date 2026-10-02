import type { Deck, Slide } from "./schema";

export function revealThresholds(slide: Slide): number[] {
  const steps = new Set<number>();
  for (const block of slide.blocks ?? []) {
    if (block.step && block.step > 0) steps.add(block.step);
    if (block.type === "bullets") {
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

export function moveForward(deck: Deck, slideIndex: number, revealed: number): { slideIndex: number; revealed: number } {
  const slide = deck.slides[slideIndex];
  const thresholds = revealThresholds(slide);
  const position = Math.max(0, thresholds.lastIndexOf(revealed));
  if (position < thresholds.length - 1) {
    return { slideIndex, revealed: thresholds[position + 1] };
  }
  if (slideIndex < deck.slides.length - 1) {
    return { slideIndex: slideIndex + 1, revealed: 0 };
  }
  return { slideIndex, revealed };
}

export function moveBack(deck: Deck, slideIndex: number, revealed: number): { slideIndex: number; revealed: number } {
  const slide = deck.slides[slideIndex];
  const thresholds = revealThresholds(slide);
  const position = Math.max(0, thresholds.indexOf(revealed));
  if (position > 0) {
    return { slideIndex, revealed: thresholds[position - 1] };
  }
  if (slideIndex > 0) {
    const previous = deck.slides[slideIndex - 1];
    const previousThresholds = revealThresholds(previous);
    return { slideIndex: slideIndex - 1, revealed: previousThresholds[previousThresholds.length - 1] };
  }
  return { slideIndex, revealed };
}

export function jumpTo(deck: Deck, slideIndex: number): { slideIndex: number; revealed: number } {
  const slide = deck.slides[slideIndex];
  const thresholds = revealThresholds(slide);
  return { slideIndex, revealed: thresholds[thresholds.length - 1] };
}
