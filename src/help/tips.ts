import { BLOCK_LABEL, WIDGET_LABEL } from "../model/insert";
import { removableNode, type ProbePath } from "../model/probe";
import type { Deck } from "../model/schema";
import { moveBack, moveForward, revealThresholds, visibleIndexes, visibleNumber } from "../model/steps";

export function forwardTip(deck: Deck, slideIndex: number, revealed: number): string {
  return moveTip(deck, slideIndex, revealed, "forward");
}

export function backTip(deck: Deck, slideIndex: number, revealed: number): string {
  return moveTip(deck, slideIndex, revealed, "back");
}

function moveTip(deck: Deck, slideIndex: number, revealed: number, direction: "forward" | "back"): string {
  const next = direction === "forward" ? moveForward(deck, slideIndex, revealed) : moveBack(deck, slideIndex, revealed);
  if (next.slideIndex === slideIndex && next.revealed === revealed) {
    return direction === "forward" ? "End of the talk." : "Start of the talk.";
  }
  if (next.slideIndex === slideIndex) {
    const thresholds = revealThresholds(deck.slides[slideIndex]!);
    const total = thresholds.length - 1;
    const which = thresholds.indexOf(next.revealed);
    if (which <= 0) return "Returns to the start of this slide.";
    return direction === "forward" ? `Reveals build ${which} of ${total}.` : `Returns to build ${which} of ${total}.`;
  }
  const slide = deck.slides[next.slideIndex];
  if (!slide) throw new Error("Navigation landed past the end of the talk.");
  const number = visibleNumber(deck, next.slideIndex);
  if (number == null) throw new Error("Navigation landed on a hidden slide.");
  const thresholds = revealThresholds(slide);
  const total = thresholds.length - 1;
  const which = thresholds.indexOf(next.revealed);
  if (which > 0 && total > 0) return `Slide ${number}: ${slide.title}, build ${which} of ${total}.`;
  return `Slide ${number}: ${slide.title}`;
}

export function counterTip(deck: Deck, slideIndex: number): string {
  const number = visibleNumber(deck, slideIndex);
  if (number == null) return "This slide is hidden. Arrow keys skip it.";
  return `Slide ${number} of ${visibleIndexes(deck).length}.`;
}

export function removeTip(deck: Deck, probe: ProbePath | null, yamlError: string | null): string {
  if (yamlError) return "The YAML has an error, so nothing can be removed until it parses.";
  const target = removableNode(probe);
  if (!target || typeof target[1] !== "number") return "Select a block or a question first.";
  const slide = deck.slides[target[1]];
  if (!slide) throw new Error("The selection is not on a slide.");
  const widgetAt = target.indexOf("widgets");
  const widgetIndex = widgetAt >= 0 ? target[widgetAt + 1] : undefined;
  if (typeof widgetIndex === "number") {
    const widget = slide.widgets?.[widgetIndex];
    if (!widget) throw new Error("The selection is not a question.");
    return `Removes the question "${widget.prompt}".`;
  }
  for (const place of ["blocks", "side"] as const) {
    const at = target.indexOf(place);
    const blockIndex = at >= 0 ? target[at + 1] : undefined;
    if (typeof blockIndex !== "number") continue;
    const block = slide[place]?.[blockIndex];
    if (!block) throw new Error("The selection is not a block.");
    const where = place === "side" ? "side column" : "slide";
    return `Removes the ${BLOCK_LABEL[block.type]} block from the ${where}.`;
  }
  return "Select a block or a question first.";
}

export function removeSlideTip(deck: Deck, slideIndex: number, yamlError: string | null): string {
  if (yamlError) return "The YAML has an error, so the slide cannot be removed until it parses.";
  if (deck.slides.length <= 1) return "The last slide cannot be removed.";
  const slide = deck.slides[slideIndex];
  if (!slide) throw new Error("There is no slide at that position.");
  return `Removes "${slide.title}".`;
}

export function insertBlocked(yamlError: string | null): string | null {
  if (yamlError) return "The YAML has an error, so nothing can be inserted until it parses.";
  return null;
}

export function historyTip(kind: "undo" | "redo", enabled: boolean): string {
  if (kind === "undo") return enabled ? "Undo the last edit in the YAML." : "Nothing to undo.";
  return enabled ? "Redo the edit you just undid." : "Nothing to redo.";
}

export function captionsTip(on: boolean, error: string | null): string {
  if (error) return error;
  if (on) return "Captions are on. They follow your voice and show on the audience window.";
  return "Turn on live captions from the microphone. They show on this window and the audience window.";
}

export function laserTip(on: boolean): string {
  return on
    ? "The laser is on. Move over the slide to point. The audience window follows."
    : "Turn on a pointer. Move over the slide. The audience window follows.";
}

export function exportTip(exporting: string | null): string {
  if (exporting) return `Exporting ${exporting}…`;
  return "Download the talk. The original file is left unchanged.";
}

export function blankTip(color: "black" | "white"): string {
  return `The audience window is ${color}. Any other key brings the slide back and does not move.`;
}

export function paneStateTip(name: string, open: boolean, pinned: boolean): string {
  if (!open) return `${name} is closed.`;
  if (pinned) return `${name} is docked. Unpin it to float over the slide.`;
  return `${name} is floating. Esc closes it.`;
}

export function pinTip(pinned: boolean, name: string): string {
  if (pinned) return `${name} is docked. Unpin it to float over the slide. Esc leaves a docked pane open.`;
  return `Pin ${name} so it docks beside the slide. While it floats, Esc closes it.`;
}

export function hideTip(name: string): string {
  return `Hide ${name}. Open it again from the toolbar.`;
}

export function showTip(name: string): string {
  return `Show ${name}.`;
}

export function widgetLabel(type: keyof typeof WIDGET_LABEL): string {
  return WIDGET_LABEL[type];
}
