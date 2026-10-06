import { realpath, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { rasterFromBytes, rasterFromDeclaredSource } from "../export/images";
import { highlightLanguageError } from "../highlight";
import { parseDeck } from "../model/parse";
import { isAssetRef, type Block, type Deck } from "../model/schema";
import { checkPackageFiles, packageAssetRefs, readDeckPackage, writeDeckPackage } from "./deckPackage";

export type PackSuccess = {
  ok: true;
  wroteZip: boolean;
  deckPath: string;
  outPath?: string;
  message: string;
};

export type PackFailure = {
  ok: false;
  problems: string[];
};

export type PackOutcome = PackSuccess | PackFailure;

/**
 * Validate a talk with the presenter, then write a zip only when it names package files.
 * A failed check writes nothing.
 */
export async function packDeckFile(deckPath: string, outPath?: string): Promise<PackOutcome> {
  const talk = path.resolve(deckPath);
  let yaml: string;
  try {
    yaml = await readFile(talk, "utf8");
  } catch (error) {
    return { ok: false, problems: [fileError(talk, error)] };
  }

  let deck: Deck;
  try {
    deck = parseDeck(yaml);
  } catch (error) {
    return { ok: false, problems: [error instanceof Error ? error.message : String(error)] };
  }

  const problems = [...languageProblems(deck), ...dataImageProblems(deck)];
  const refs = packageAssetRefs(deck);
  if (refs.includes("deck.yaml")) {
    problems.push("deck.yaml is the talk inside the package. An image cannot use that path.");
  }

  const talkDir = path.dirname(talk);
  const files = new Map<string, Uint8Array>();
  for (const ref of refs) {
    if (ref === "deck.yaml") continue;
    const read = await readPackageFile(talkDir, ref);
    if ("problem" in read) {
      problems.push(read.problem);
      continue;
    }
    try {
      rasterFromBytes(read.bytes);
    } catch (error) {
      problems.push(`${ref}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    files.set(ref, read.bytes);
  }
  if (problems.length > 0) return { ok: false, problems };

  if (refs.length === 0) {
    return {
      ok: true,
      wroteZip: false,
      deckPath: talk,
      message: [
        "Talk is valid. It names no package files, so no zip was written.",
        `Open this file after the theme is loaded: ${talk}`,
      ].join("\n"),
    };
  }

  try {
    checkPackageFiles(deck, files);
  } catch (error) {
    return { ok: false, problems: [error instanceof Error ? error.message : String(error)] };
  }

  const destination = outPath ? path.resolve(outPath) : defaultZipPath(talk);
  if (destination === talk) {
    return { ok: false, problems: ["The package path has to be a different file from the talk."] };
  }
  const blob = await writeDeckPackage(yaml, files);
  const packed = await blob.arrayBuffer();
  try {
    const opened = await readDeckPackage(packed);
    checkPackageFiles(parseDeck(opened.yaml), opened.files);
  } catch (error) {
    return { ok: false, problems: [error instanceof Error ? error.message : String(error)] };
  }
  await writeFile(destination, new Uint8Array(packed));
  return {
    ok: true,
    wroteZip: true,
    deckPath: talk,
    outPath: destination,
    message: ["Talk is valid. Package:", destination, "Open that zip after the theme is loaded."].join("\n"),
  };
}

function dataImageProblems(deck: Deck): string[] {
  const problems: string[] = [];
  for (const slide of deck.slides) {
    for (const block of [...(slide.blocks ?? []), ...(slide.side ?? [])]) {
      if (block.type !== "image" || !block.src.startsWith("data:")) continue;
      try {
        rasterFromDeclaredSource(block.src);
      } catch (error) {
        problems.push(`${slide.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return problems;
}

function languageProblems(deck: Deck): string[] {
  const problems: string[] = [];
  for (const slide of deck.slides) {
    for (const block of [...(slide.blocks ?? []), ...(slide.side ?? [])]) {
      const problem = codeLanguageProblem(slide.id, block);
      if (problem) problems.push(problem);
    }
  }
  return problems;
}

function codeLanguageProblem(slideId: string, block: Block): string | null {
  if (block.type !== "code") return null;
  const problem = highlightLanguageError(block.language);
  return problem ? `${slideId}: ${problem}` : null;
}

async function readPackageFile(talkDir: string, ref: string): Promise<{ bytes: Uint8Array } | { problem: string }> {
  if (!isAssetRef(ref) || ref.startsWith("https://") || ref.startsWith("data:")) {
    return { problem: `"${ref}" is not a package path the presenter can carry.` };
  }
  let root: string;
  try {
    root = await realpath(talkDir);
  } catch (error) {
    return { problem: fileError(talkDir, error) };
  }
  const lexical = path.resolve(root, ref);
  if (outside(root, lexical)) {
    return { problem: `"${ref}" is outside the talk directory.` };
  }
  let canonical: string;
  try {
    canonical = await realpath(lexical);
  } catch {
    return { problem: `The talk names a file that is not beside it: ${ref}.` };
  }
  if (outside(root, canonical)) {
    return { problem: `"${ref}" is outside the talk directory.` };
  }
  try {
    if (!(await stat(canonical)).isFile()) return { problem: `"${ref}" is not a file.` };
  } catch (error) {
    return { problem: fileError(ref, error) };
  }
  return { bytes: new Uint8Array(await readFile(canonical)) };
}

function outside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
}

function defaultZipPath(talk: string): string {
  const extension = path.extname(talk);
  const stem = extension ? talk.slice(0, -extension.length) : talk;
  return `${stem}.zip`;
}

function fileError(label: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `${label}: ${message}`;
}
