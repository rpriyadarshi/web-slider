import { localFileUrl } from "../model/install";
import { readDeckPackage } from "./deckPackage";

export type DeckSource = { url: string; label: string; zip: boolean; baseUrl?: string };

export type FetchedDeck = { yaml: string; files: Map<string, Uint8Array>; baseUrl?: string };

/** The talk a config names. A disk path is read through the dev server, which cannot serve its siblings by relative URL. */
export function shippedDeckSource(origin: string, deckPath: string): DeckSource {
  const zip = /\.zip$/i.test(deckPath);
  if (deckPath.startsWith("/")) return { url: localFileUrl(origin, deckPath), label: deckPath, zip };
  const url = new URL(deckPath, origin.endsWith("/") ? origin : `${origin}/`);
  return { url: url.href, label: deckPath, zip, baseUrl: new URL("./", url).href };
}

/** A `?deck=` link, resolved against the page that carries it. */
export function linkedDeckSource(pageUrl: string, deck: string): DeckSource {
  const url = new URL(deck, pageUrl);
  return { url: url.href, label: deck, zip: /\.zip$/i.test(url.pathname), baseUrl: new URL("./", url).href };
}

/** `?deck=` outranks the config's talk. Null leaves the boot to the stored session, then the start screen. */
export function bootDeckSource(input: {
  embed: boolean;
  deckParam: string | null;
  deckPath: string | undefined;
  origin: string;
  pageUrl: string;
}): DeckSource | null {
  if (input.embed) return null;
  const linked = input.deckParam?.trim();
  if (linked) return linkedDeckSource(input.pageUrl, linked);
  if (input.deckPath) return shippedDeckSource(input.origin, input.deckPath);
  return null;
}

export async function fetchDeck(fetchImpl: typeof fetch, source: DeckSource): Promise<FetchedDeck> {
  const response = await fetchImpl(source.url);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    const shown = detail && !detail.startsWith("<") ? `\n${detail}` : "";
    throw new Error(`Deck failed to load (${response.status}): ${source.label}${shown}`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0) throw new Error(`Deck is empty: ${source.label}`);
  if (isHtml(response.headers.get("content-type") ?? "", new Uint8Array(buffer))) {
    throw new Error(`Deck not found: ${source.label}. The server returned HTML instead of the deck.`);
  }
  const base = source.baseUrl ? { baseUrl: source.baseUrl } : {};
  if (source.zip) return { ...(await readDeckPackage(buffer)), ...base };
  return { yaml: new TextDecoder().decode(buffer), files: new Map(), ...base };
}

/** Re-reads the config's talk, never `?deck=` or the last file opened. Stored notes are cleared only after it is ready. */
export async function resetToShipped<T>(input: {
  deckPath: string | undefined;
  origin: string;
  fetch: typeof fetch;
  prepare: (pack: FetchedDeck) => Promise<T>;
  clear: () => void;
  apply: (prepared: T) => void;
}): Promise<void> {
  if (!input.deckPath) throw new Error("This install names no shipped talk.");
  const pack = await fetchDeck(input.fetch, shippedDeckSource(input.origin, input.deckPath));
  const prepared = await input.prepare(pack);
  input.clear();
  input.apply(prepared);
}

function isHtml(type: string, bytes: Uint8Array): boolean {
  if (type.toLowerCase().includes("text/html")) return true;
  const head = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}
