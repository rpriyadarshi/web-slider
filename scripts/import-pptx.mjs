import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const USAGE = `Usage: npm run import-pptx -- --pptx <file.pptx> --out <directory> [--deck <name.yaml>]

Compiles the PowerPoint into a talk. Each text box keeps its box. A fill is a ground behind the text. A picture is written beside the talk. Then pack the yaml this prints.`;

function readArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        pptx: { type: "string" },
        out: { type: "string" },
        deck: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
  if (!values.pptx || !values.out) throw new Error(USAGE);
  if (!/\.pptx$/i.test(values.pptx)) throw new Error(`--pptx must be a .pptx file: ${values.pptx}\n${USAGE}`);
  const deckName = values.deck ?? "deck.yaml";
  if (!/\.ya?ml$/i.test(deckName) || deckName.includes("/") || deckName.includes("\\")) {
    throw new Error(`--deck must be a file name in the output directory: ${deckName}\n${USAGE}`);
  }
  return { pptx: path.resolve(values.pptx), out: path.resolve(values.out), deckName };
}

async function loadImporter() {
  const outfile = path.join(repoRoot, "node_modules", ".cache", "web-slider-import-pptx.mjs");
  await mkdir(path.dirname(outfile), { recursive: true });
  await build({
    absWorkingDir: repoRoot,
    entryPoints: [path.join(repoRoot, "src", "import", "pptx.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    packages: "external",
    logLevel: "silent",
  });
  const loaded = await import(pathToFileURL(outfile).href);
  if (typeof loaded.importPptx !== "function") throw new Error("The PowerPoint compiler did not load.");
  return loaded.importPptx;
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  try {
    const args = readArgs(process.argv.slice(2));
    const importPptx = await loadImporter();
    const assets = [];
    const yaml = await importPptx(await readFile(args.pptx), path.basename(args.pptx), assets);
    await mkdir(args.out, { recursive: true });
    const deckPath = path.join(args.out, args.deckName);
    const note = `# Compiled from ${path.basename(args.pptx)}. The sentences and the boxes are the source.\n`;
    await writeFile(deckPath, note + yaml);
    for (const asset of assets) {
      const dest = path.join(args.out, asset.path);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, asset.bytes);
    }
    console.log(deckPath);
    for (const asset of assets) console.log(path.join(args.out, asset.path));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
