export const SHARE_ROUTE = "/__slider/share";

/** Response header carrying the `node scripts/share.mjs ...` line the dev server ran. */
export const SHARE_COMMAND_HEADER = "X-Slider-Command";

const NO_SERVER =
  "Runnable package is built by the Web Slider dev or preview server. Start it with npm run dev -- --config /absolute/path/to/web-slider.config.yaml, open the talk, and export again.";

export class RunnableExportError extends Error {
  readonly command: string;

  constructor(message: string, command: string) {
    super(message);
    this.name = "RunnableExportError";
    this.command = command;
  }
}

/** One shell line for the exact `node` invocation the share route spawns. */
export function shareCommand(node: string, script: string, args: readonly string[]): string {
  return [node, script, ...args].map(quoteShell).join(" ");
}

/** Banner form of a `shareCommand` line: program and script, then each flag with its value. */
export function shareCommandDisplay(command: string): string {
  const words = shellWords(command);
  if (words.length < 2) return command;
  const lines = [`${words[0]} ${words[1]}`];
  for (let index = 2; index < words.length; index += 2) {
    const value = words[index + 1];
    lines.push(value === undefined ? words[index] : `${words[index]} ${value}`);
  }
  return lines.join(" \\\n  ");
}

function shellWords(command: string): string[] {
  const words: string[] = [];
  let index = 0;
  while (index < command.length) {
    while (command[index] === " ") index += 1;
    if (index >= command.length) break;
    const start = index;
    if (command[index] === "'") {
      index += 1;
      while (index < command.length) {
        if (command.startsWith("'\\''", index)) {
          index += 4;
          continue;
        }
        if (command[index] === "'") {
          index += 1;
          break;
        }
        index += 1;
      }
    } else {
      while (index < command.length && command[index] !== " ") index += 1;
    }
    words.push(command.slice(start, index));
  }
  return words;
}

function quoteShell(arg: string): string {
  if (arg.length > 0 && /^[A-Za-z0-9_./:@+=,-]+$/.test(arg)) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

export type RunnablePackage = { blob: Blob; command: string };

/** Sends the open talk's package to the dev server, which builds the presenter and this theme around it. */
export async function requestRunnablePackage(
  fetchImpl: typeof fetch,
  origin: string,
  deckPackage: Blob,
  deckId: string,
): Promise<RunnablePackage> {
  const url = new URL(SHARE_ROUTE, origin.endsWith("/") ? origin : `${origin}/`);
  url.searchParams.set("name", deckId);
  const response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/zip" }, body: deckPackage });
  const command = response.headers.get(SHARE_COMMAND_HEADER) ?? "";
  const type = response.headers.get("content-type") ?? "";
  if (response.status === 404 || response.status === 405 || type.includes("text/html")) throw new RunnableExportError(NO_SERVER, command);
  if (!response.ok) {
    const text = (await response.text()).trim();
    throw new RunnableExportError(text || `Runnable package failed (${response.status}).`, command);
  }
  if (!type.includes("application/zip")) throw new RunnableExportError(NO_SERVER, command);
  return { blob: await response.blob(), command };
}
