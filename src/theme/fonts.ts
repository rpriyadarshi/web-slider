import { FONT_NAMES, type FontMap, type FontName } from "../model/schema";

export type FontFiles = Record<FontName, { regular: Uint8Array; semibold: Uint8Array }>;

export function fontFaceRules(fonts: FontMap, assets?: Map<string, string>): string {
  return Object.entries(fonts)
    .map(([name, face]) => {
      const regular = fontUrl(face.regular, assets);
      const semibold = fontUrl(face.semibold ?? face.regular, assets);
      return `@font-face{font-family:"${name}";src:url("${regular}") format("truetype");font-weight:400;font-display:swap;}@font-face{font-family:"${name}";src:url("${semibold}") format("truetype");font-weight:600;font-display:swap;}`;
    })
    .join("");
}

export function applyFontFaces(fonts: FontMap | undefined, assets?: Map<string, string>): () => void {
  if (!fonts || Object.keys(fonts).length === 0) return () => undefined;
  const style = document.createElement("style");
  style.dataset.themeFonts = "true";
  style.textContent = fontFaceRules(fonts, assets);
  document.head.appendChild(style);
  return () => style.remove();
}

async function readFont(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Font failed to load (${response.status}): ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = response.headers.get("content-type") ?? "";
  const head = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart().toLowerCase();
  if (bytes.byteLength === 0 || type.toLowerCase().includes("text/html") || head.startsWith("<!doctype") || head.startsWith("<html")) {
    throw new Error(`Font failed to load: ${url}`);
  }
  return bytes;
}

export async function loadFontFiles(fonts: FontMap | undefined, assets?: Map<string, string>): Promise<FontFiles> {
  const entries = await Promise.all(
    FONT_NAMES.map(async (name) => {
      const face = fonts?.[name];
      if (!face?.regular) {
        throw new Error(`Font "${name}" has no file. Name it in the theme package fonts map.`);
      }
      const [regular, semibold] = await Promise.all([
        readFont(fontUrl(face.regular, assets)),
        readFont(fontUrl(face.semibold ?? face.regular, assets)),
      ]);
      return [name, { regular, semibold }] as const;
    }),
  );
  return Object.fromEntries(entries) as FontFiles;
}

function fontUrl(ref: string, assets?: Map<string, string>): string {
  const mapped = assets?.get(ref);
  if (mapped) return mapped;
  if (ref.startsWith("https://") || ref.startsWith("http://") || ref.startsWith("data:") || ref.startsWith("blob:") || ref.startsWith("/")) {
    return ref;
  }
  return `/${ref}`;
}
