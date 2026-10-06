import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export const PACK_USAGE = `Usage: npm run pack -- --deck <talk.yaml> [--out <talk.zip>]

Validates the talk with the presenter schema. Writes a zip only when the talk names package files. Prints every problem and writes nothing when validation fails.`;

export function readPackArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { deck: { type: "string" }, out: { type: "string" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${PACK_USAGE}`);
  }
  if (!values.deck) throw new Error(PACK_USAGE);
  if (!/\.ya?ml$/i.test(values.deck)) throw new Error(`--deck must be a .yaml talk: ${values.deck}\n${PACK_USAGE}`);
  if (values.out && !/\.zip$/i.test(values.out)) throw new Error(`--out must end in .zip: ${values.out}\n${PACK_USAGE}`);
  const deck = path.resolve(values.deck);
  const out = values.out ? path.resolve(values.out) : undefined;
  if (out && out === deck) throw new Error(`--out must be a different file from the talk.\n${PACK_USAGE}`);
  return { deck, out };
}

/** Load packDeckFile from the presenter source so the script cannot grow a second validator. */
export async function loadPackDeckFile() {
  const outdir = path.join(repoRoot, "node_modules", ".cache");
  const outfile = path.join(outdir, "web-slider-pack.mjs");
  await mkdir(outdir, { recursive: true });
  await build({
    absWorkingDir: repoRoot,
    entryPoints: [path.join(repoRoot, "src", "package", "packTalk.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    packages: "external",
    logLevel: "silent",
  });
  const loaded = await import(pathToFileURL(outfile).href);
  if (typeof loaded.packDeckFile !== "function") throw new Error("The presenter packer did not load.");
  return { packDeckFile: loaded.packDeckFile, close: async () => {} };
}

export function reportPack(result) {
  if (!result.ok) {
    console.error("The talk was not packed.");
    for (const problem of result.problems) console.error(problem);
    return 1;
  }
  console.log(result.message);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  try {
    const args = readPackArgs(process.argv.slice(2));
    const packer = await loadPackDeckFile();
    try {
      const code = reportPack(await packer.packDeckFile(args.deck, args.out));
      if (code !== 0) process.exitCode = code;
    } finally {
      await packer.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
