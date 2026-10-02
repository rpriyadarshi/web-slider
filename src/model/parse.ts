import YAML from "js-yaml";
import { ZodError } from "zod";
import { deckSchema, type Deck } from "./schema";

export function parseDeck(source: string): Deck {
  if (source.trim() === "") {
    throw new Error("Deck YAML is empty.");
  }

  let loaded: unknown;
  try {
    loaded = YAML.load(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid YAML:\n${message}`);
  }

  if (loaded === null || typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error("Deck must be a YAML mapping.");
  }

  try {
    return deckSchema.parse(loaded);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.join(".") || "(deck)"}: ${issue.message}`)
        .join("\n");
      throw new Error(`Deck failed validation:\n${details}`);
    }
    throw error;
  }
}
