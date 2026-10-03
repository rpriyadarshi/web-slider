import JSZip from "jszip";
import type { Block, Deck } from "../model/schema";

export async function readDeckPackage(data: ArrayBuffer): Promise<{ yaml: string; files: Map<string, Uint8Array> }> {
  const zip = await JSZip.loadAsync(data);
  const named = zip.file("deck.yaml");
  const fallback = zip.file(/[^/]+\.ya?ml$/i).find((entry) => !entry.dir);
  const yamlEntry = named ?? fallback;
  if (!yamlEntry) {
    throw new Error("Package has no deck.yaml.");
  }

  const files = new Map<string, Uint8Array>();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const path = entry.name.replace(/^\.\//, "");
    files.set(path, await entry.async("uint8array"));
  }
  return { yaml: await yamlEntry.async("string"), files };
}

export async function writeDeckPackage(yaml: string, files: Map<string, Uint8Array>): Promise<Blob> {
  const zip = new JSZip();
  zip.file("deck.yaml", yaml);
  for (const [path, bytes] of files) {
    if (path === "deck.yaml") continue;
    zip.file(path, bytes);
  }
  return zip.generateAsync({ type: "blob" });
}

export function packageAssetRefs(deck: Deck): string[] {
  const refs = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value || value.startsWith("https://") || value.startsWith("data:")) return;
    refs.add(value);
  };
  if (deck.brand && typeof deck.brand !== "string") {
    add(deck.brand.mark);
    add(deck.brand.markDark);
  }
  for (const face of Object.values(deck.fonts ?? {})) {
    add(face.regular);
    add(face.semibold);
  }
  for (const slide of deck.slides) {
    for (const block of [...(slide.blocks ?? []), ...(slide.side ?? [])]) {
      if (block.type === "image") add(block.src);
    }
  }
  return [...refs];
}

export async function bindPackageAssets(
  refs: string[],
  files: Map<string, Uint8Array>,
  baseUrl?: string,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const ref of refs) {
    const packed = files.get(ref);
    if (packed) {
      const copy = new ArrayBuffer(packed.byteLength);
      new Uint8Array(copy).set(packed);
      urls.set(ref, URL.createObjectURL(new Blob([copy], { type: mimeFor(ref) })));
      continue;
    }
    if (baseUrl) {
      const response = await fetch(new URL(ref, baseUrl));
      if (!response.ok) {
        throw new Error(`Asset failed to load (${response.status}): ${ref}`);
      }
      urls.set(ref, URL.createObjectURL(await response.blob()));
      continue;
    }
    throw new Error(
      `"${ref}" is a package path. Open a .zip that contains it, or embed the file as a data URI in the YAML.`,
    );
  }
  return urls;
}

export function deckWithAssetUrls(deck: Deck, urls: Map<string, string>): Deck {
  const mapRef = (src: string) => urls.get(src) ?? src;
  const mapBlocks = (blocks: Block[] | undefined) =>
    blocks?.map((block) => (block.type === "image" ? { ...block, src: mapRef(block.src) } : block));
  const brand =
    deck.brand && typeof deck.brand !== "string"
      ? {
          ...deck.brand,
          mark: mapRef(deck.brand.mark),
          markDark: deck.brand.markDark ? mapRef(deck.brand.markDark) : undefined,
        }
      : deck.brand;
  return {
    ...deck,
    brand,
    slides: deck.slides.map((slide) => ({
      ...slide,
      blocks: mapBlocks(slide.blocks),
      side: mapBlocks(slide.side),
    })),
  };
}

function mimeFor(path: string): string {
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".ttf")) return "font/ttf";
  if (path.endsWith(".otf")) return "font/otf";
  return "application/octet-stream";
}
