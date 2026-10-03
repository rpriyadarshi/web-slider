import type { Deck, Widget } from "./schema";
import { revealThresholds } from "./steps";

export type WidgetAnswer = string | string[] | number;

export type DeckSession = {
  slideIndex: number;
  revealed: number;
  answers: Record<string, Record<string, WidgetAnswer>>;
  notes: Record<string, string>;
  ui: {
    toc: boolean;
    side: boolean;
    bottom: boolean;
    yaml: boolean;
    tocPinned: boolean;
    sidePinned: boolean;
    yamlPinned: boolean;
    theme: "light" | "dark";
  };
};

export function emptyChrome(): DeckSession["ui"] {
  return { toc: true, side: false, bottom: true, yaml: true, tocPinned: false, sidePinned: false, yamlPinned: true, theme: "dark" };
}

export function sessionFromDeck(deck: Deck): DeckSession {
  const answers: DeckSession["answers"] = {};
  const notes: DeckSession["notes"] = {};

  for (const slide of deck.slides) {
    if (slide.takenNotes) notes[slide.id] = slide.takenNotes;
    for (const widget of slide.widgets ?? []) {
      if (widget.answer !== undefined) {
        answers[slide.id] ??= {};
        answers[slide.id][widget.id] = widget.answer;
      }
    }
  }

  return {
    slideIndex: 0,
    revealed: 0,
    answers,
    notes,
    ui: { ...emptyChrome(), theme: deck.theme?.chrome ?? "dark" },
  };
}

export function answerFor(session: DeckSession, slideId: string, widgetId: string): WidgetAnswer | undefined {
  return session.answers[slideId]?.[widgetId];
}

export function widgetAnswer(widget: Widget, session: DeckSession, slideId: string): WidgetAnswer | undefined {
  return answerFor(session, slideId, widget.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSession(deck: Deck, input: unknown): DeckSession {
  if (!isRecord(input)) throw new Error("Stored session is invalid.");

  const slideIndex = input.slideIndex;
  if (typeof slideIndex !== "number" || !Number.isInteger(slideIndex) || slideIndex < 0 || slideIndex >= deck.slides.length) {
    throw new Error("Stored session slide index is invalid.");
  }

  const revealed = input.revealed;
  if (typeof revealed !== "number" || !Number.isInteger(revealed) || revealed < 0) {
    throw new Error("Stored session reveal state is invalid.");
  }

  if (!isRecord(input.answers) || !isRecord(input.notes) || !isRecord(input.ui)) {
    throw new Error("Stored session is invalid.");
  }

  const ui = input.ui;
  if (typeof ui.toc !== "boolean" || typeof ui.side !== "boolean" || typeof ui.bottom !== "boolean") {
    throw new Error("Stored session panel state is invalid.");
  }

  const theme = ui.theme === undefined ? "dark" : ui.theme;
  if (theme !== "light" && theme !== "dark") {
    throw new Error("Stored session theme is invalid.");
  }

  return {
    slideIndex,
    revealed: clampRevealed(deck.slides[slideIndex], revealed),
    answers: input.answers as DeckSession["answers"],
    notes: input.notes as DeckSession["notes"],
    ui: {
      toc: ui.toc,
      side: ui.side,
      bottom: ui.bottom,
      yaml: ui.yaml === true,
      tocPinned: ui.tocPinned === true,
      sidePinned: ui.sidePinned === true,
      yamlPinned: ui.yamlPinned !== false,
      theme,
    },
  };
}

export function clampRevealed(slide: Deck["slides"][number], revealed: number): number {
  const thresholds = revealThresholds(slide);
  let chosen = 0;
  for (const threshold of thresholds) {
    if (threshold <= revealed) chosen = threshold;
  }
  return chosen;
}
