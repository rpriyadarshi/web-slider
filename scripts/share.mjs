import "./share-stdin.mjs";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import YAML from "js-yaml";
import JSZip from "jszip";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const shareRoot = path.join(repoRoot, "scripts", "share");
const viteBin = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");

export const STAGED_CONFIG = "talk/web-slider.config.yaml";
export const RUNTIMES = ["server-darwin-arm64", "server-darwin-amd64", "server-windows-amd64.exe", "server-linux-amd64"];
const LAUNCHERS = [
  { name: "Start.command", crlf: false },
  { name: "start.sh", crlf: false },
  { name: "Start.bat", crlf: true },
  { name: "README.txt", crlf: true },
];
const USAGE =
  "Usage: npm run share -- --config /absolute/path/to/web-slider.config.yaml --deck /absolute/path/to/talk.zip --out /absolute/path/to/name-presenter.zip";

export function readShareArgs(argv) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { config: { type: "string" }, deck: { type: "string" }, out: { type: "string" }, name: { type: "string" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
  }
  const { config, deck, out } = values;
  if (!config || !deck || !out) throw new Error(USAGE);
  if (!path.isAbsolute(config) || !/\.ya?ml$/.test(config)) throw new Error(`--config must be an absolute path to a .yaml config: ${config}`);
  if (!path.isAbsolute(deck) || !/\.(zip|ya?ml)$/i.test(deck)) throw new Error(`--deck must be an absolute path to a .zip or .yaml talk: ${deck}`);
  if (!path.isAbsolute(out) || !/\.zip$/i.test(out)) throw new Error(`--out must be an absolute path ending in .zip: ${out}`);
  const name = values.name ?? path.basename(out).replace(/\.zip$/i, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new Error(`The package folder name must be a plain file name: ${name}`);
  return { config, deck, out, name };
}

/** The theme a config on disk names: its manifest and every mark, font, and font licence beside it. */
export async function readTheme(configPath) {
  const config = readMapping(await readFile(configPath, "utf8"), configPath);
  const extra = Object.keys(config).filter((key) => key !== "manifest" && key !== "deck");
  if (extra.length > 0) throw new Error(`Config ${configPath} has keys a config does not carry: ${extra.join(", ")}.`);
  if (typeof config.manifest !== "string" || !besideRef(config.manifest) || !/\.ya?ml$/.test(config.manifest)) {
    throw new Error(
      `Config ${configPath}: manifest must name a manifest beside the config. A package name or a samples/ path is not carried into a runnable package.`,
    );
  }
  const manifestPath = path.join(path.dirname(configPath), config.manifest);
  const manifestYaml = await readFile(manifestPath, "utf8");
  const manifest = readMapping(manifestYaml, manifestPath);
  if (!manifest.brand || typeof manifest.brand !== "object" || Array.isArray(manifest.brand)) {
    throw new Error(
      `Manifest ${manifestPath}: brand must be a mapping with its own marks. A brand package name is not carried into a runnable package.`,
    );
  }
  const manifestDir = path.dirname(manifestPath);
  const marks = [manifest.brand.mark, manifest.brand.markDark].filter(isPackedRef);
  const fonts = Object.values(manifest.fonts ?? {}).flatMap((face) => [face?.regular, face?.semibold]).filter(isPackedRef);
  for (const ref of [...marks, ...fonts]) {
    if (!besideRef(ref)) throw new Error(`Manifest ${manifestPath}: ${ref} must be a file beside the manifest.`);
    if (!existsSync(path.join(manifestDir, ref))) throw new Error(`Theme file not found: ${path.join(manifestDir, ref)}`);
  }
  const notices = await fontNotices(manifestDir, fonts);
  return { manifestDir, manifestYaml, files: [...new Set([...marks, ...fonts, ...notices])] };
}

/** The talk to ship. A zip must carry every file its deck names; a bare YAML talk must name none. */
export async function readTalk(deckPath) {
  const bytes = await readFile(deckPath);
  if (/\.zip$/i.test(deckPath)) {
    const zip = await JSZip.loadAsync(bytes);
    const entry = zip.file("deck.yaml") ?? zip.file(/[^/]+\.ya?ml$/i).find((item) => !item.dir);
    if (!entry) throw new Error(`Talk ${deckPath} has no deck.yaml.`);
    const carried = new Set(
      Object.values(zip.files)
        .filter((item) => !item.dir)
        .map((item) => item.name.replace(/^\.\//, "")),
    );
    const missing = talkRefs(readMapping(await entry.async("string"), `${deckPath}: ${entry.name}`)).filter((ref) => !carried.has(ref));
    if (missing.length > 0) {
      throw new Error(`The talk names files it does not carry: ${missing.join(", ")}. Open the talk's .zip so those files travel with it. (${deckPath})`);
    }
    return { bytes, name: "deck.zip" };
  }
  const refs = talkRefs(readMapping(bytes.toString("utf8"), deckPath));
  if (refs.length > 0) {
    throw new Error(`Talk ${deckPath} names package files (${refs.join(", ")}). Pass it as a .zip (Export → Package) so they travel with it.`);
  }
  return { bytes, name: "deck.yaml" };
}

/** Same refs as packageAssetRefs in src/package/deckPackage.ts. */
export function talkRefs(deck) {
  const refs = new Set();
  const add = (value) => {
    if (isPackedRef(value)) refs.add(value);
  };
  if (deck.brand && typeof deck.brand === "object") {
    add(deck.brand.mark);
    add(deck.brand.markDark);
  }
  for (const face of Object.values(deck.fonts ?? {})) {
    add(face?.regular);
    add(face?.semibold);
  }
  for (const slide of Array.isArray(deck.slides) ? deck.slides : []) {
    for (const block of [...(slide?.blocks ?? []), ...(slide?.side ?? [])]) {
      if (block?.type === "image") add(block.src);
    }
  }
  return [...refs];
}

export function stagedConfig(deck) {
  return `# Written by npm run share. The presenter loads this theme and opens the shipped talk.\nmanifest: talk/manifest.yaml\ndeck: ${deck}\n`;
}

export async function stageTalk({ theme, talk, appDir }) {
  const talkDir = path.join(appDir, "talk");
  await mkdir(talkDir, { recursive: true });
  await writeFile(path.join(talkDir, "manifest.yaml"), theme.manifestYaml);
  for (const ref of theme.files) {
    const target = path.join(talkDir, ref);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(theme.manifestDir, ref), target);
  }
  await writeFile(path.join(talkDir, talk.name), talk.bytes);
  await writeFile(path.join(appDir, STAGED_CONFIG), stagedConfig(`talk/${talk.name}`));
}

export function checkIndex(html) {
  if (!html.includes(`data-slider-config="${STAGED_CONFIG}"`)) {
    throw new Error(`The built index.html does not carry data-slider-config="${STAGED_CONFIG}".`);
  }
}

export function missingRuntimes(dir = path.join(shareRoot, "runtime")) {
  return RUNTIMES.filter((name) => !existsSync(path.join(dir, name)));
}

export function isExecutable(file) {
  return file === "Start.command" || file === "start.sh" || file.startsWith("runtime/server-");
}

export async function zipFolder(rootDir, name) {
  const zip = new JSZip();
  for (const file of await listFiles(rootDir)) {
    zip.file(`${name}/${file}`, await readFile(path.join(rootDir, file)), { unixPermissions: isExecutable(file) ? 0o755 : 0o644 });
  }
  return zip.generateAsync({ type: "nodebuffer", platform: "UNIX", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function share(args) {
  const theme = await readTheme(args.config);
  const talk = await readTalk(args.deck);
  const missing = missingRuntimes();
  if (missing.length > 0) {
    throw new Error(`Runtime binaries are missing from scripts/share/runtime/: ${missing.join(", ")}. Run npm run share:runtime (needs Go), then share again.`);
  }
  const stage = await mkdtemp(path.join(os.tmpdir(), "web-slider-share-"));
  try {
    const root = path.join(stage, args.name);
    const appDir = path.join(root, "app");
    await buildPresenter(appDir);
    await stageTalk({ theme, talk, appDir });
    await stageLaunchers(root);
    const bytes = await zipFolder(root, args.name);
    await mkdir(path.dirname(args.out), { recursive: true });
    await writeFile(args.out, bytes);
    return { out: args.out, bytes: bytes.byteLength };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

async function buildPresenter(appDir) {
  if (!existsSync(viteBin)) throw new Error(`Vite CLI not found: ${viteBin}. Run npm ci in ${repoRoot}.`);
  await run(process.execPath, [viteBin, "build", "--outDir", appDir, "--emptyOutDir"], {
    cwd: repoRoot,
    env: { ...process.env, CI: "1", NODE_ENV: "production", SLIDER_CONFIG: STAGED_CONFIG, SLIDER_SHARE_BUILD: "1" },
  });
  checkIndex(await readFile(path.join(appDir, "index.html"), "utf8"));
}

async function stageLaunchers(rootDir) {
  for (const launcher of LAUNCHERS) {
    const text = await readFile(path.join(shareRoot, launcher.name), "utf8");
    const body = launcher.crlf ? text.replace(/\r?\n/g, "\r\n") : text.replace(/\r\n/g, "\n");
    await writeFile(path.join(rootDir, launcher.name), body);
  }
  await mkdir(path.join(rootDir, "runtime"), { recursive: true });
  for (const name of RUNTIMES) {
    await copyFile(path.join(shareRoot, "runtime", name), path.join(rootDir, "runtime", name));
  }
}

async function fontNotices(manifestDir, fonts) {
  const notices = [];
  for (const dir of new Set(fonts.map((ref) => path.posix.dirname(ref)))) {
    for (const entry of await readdir(path.join(manifestDir, dir), { withFileTypes: true })) {
      if (entry.isFile() && /licen[cs]e|ofl|copying|notice/i.test(entry.name)) notices.push(dir === "." ? entry.name : `${dir}/${entry.name}`);
    }
  }
  return notices;
}

async function listFiles(rootDir, prefix = "") {
  const files = [];
  for (const entry of await readdir(path.join(rootDir, prefix), { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(rootDir, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

function readMapping(text, label) {
  let loaded;
  try {
    loaded = YAML.load(text);
  } catch (error) {
    throw new Error(`Invalid YAML in ${label}:\n${error instanceof Error ? error.message : String(error)}`);
  }
  if (loaded === null || typeof loaded !== "object" || Array.isArray(loaded)) throw new Error(`${label} must be a YAML mapping.`);
  return loaded;
}

function isPackedRef(value) {
  return typeof value === "string" && value !== "" && !value.startsWith("https://") && !value.startsWith("data:");
}

function besideRef(ref) {
  return (
    ref.trim() === ref &&
    !ref.startsWith("/") &&
    !ref.startsWith("samples/") &&
    !ref.includes("\\") &&
    !ref.includes("://") &&
    !ref.split("/").includes("..")
  );
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`The presenter build failed (exit ${code}).\n${output.trim()}`));
    });
  });
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  try {
    const result = await share(readShareArgs(process.argv.slice(2)));
    console.log(`Runnable package: ${result.out} (${(result.bytes / 1024 / 1024).toFixed(1)} MB)`);
    console.log("Recipients unpack it and double-click Start.command (macOS) or Start.bat (Windows), or run ./start.sh (Linux).");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
