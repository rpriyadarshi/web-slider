import type { Deck } from "../model/schema";
import { serializeDeck } from "../model/serialize";
import type { DeckSession } from "../model/session";

export function deckToYaml(deck: Deck, session: DeckSession): string {
  return serializeDeck(deck, session);
}
