import type { DeckSession } from "../model/session";

const STORAGE_KEY = "web-slider.v1";

export type PersistedDeck = {
  deckYaml: string;
  session: DeckSession;
};

export function loadPersisted(): PersistedDeck | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Stored presentation could not be read:\n${message}`);
  }

  if (!parsed || typeof parsed !== "object" || !("deckYaml" in parsed) || !("session" in parsed)) {
    throw new Error("Stored presentation is missing the deck or the session.");
  }

  const record = parsed as { deckYaml: unknown; session: unknown };
  if (typeof record.deckYaml !== "string") {
    throw new Error("Stored presentation deck is not text.");
  }

  return { deckYaml: record.deckYaml, session: record.session as DeckSession };
}

export function savePersisted(value: PersistedDeck): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearPersisted(): void {
  localStorage.removeItem(STORAGE_KEY);
}
