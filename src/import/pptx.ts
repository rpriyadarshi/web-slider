import JSZip from "jszip";
import YAML from "js-yaml";

type Paragraph = { text: string; bullet: boolean };
type Shape = { title: boolean; subtitle: boolean; skip: boolean; paragraphs: Paragraph[] };

export async function importPptx(bytes: ArrayBuffer | Uint8Array, filename: string): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const presentation = await textFile(zip, "ppt/presentation.xml");
  const rels = await textFile(zip, "ppt/_rels/presentation.xml.rels");
  const order = slideTargets(presentation, rels);
  if (order.length === 0) throw new Error("This PowerPoint has no slides.");

  const slides = [];
  for (const [index, target] of order.entries()) {
    const path = normalizeTarget("ppt", target);
    const xml = await textFile(zip, path);
    const notes = await notesText(zip, path);
    const imported = slideFromXml(xml, notes, index + 1);
    if (imported) slides.push(imported);
  }
  if (slides.length === 0) {
    throw new Error("This PowerPoint has no titles, bullets, or notes to import. Animations, pictures, and charts are left out.");
  }

  const title = (await coreTitle(zip)) || filename.replace(/\.pptx$/i, "") || "Imported deck";
  const document = {
    id: deckId(title),
    title,
    slides,
  };
  return YAML.dump(document, { lineWidth: -1, noRefs: true });
}

function slideFromXml(xml: string, notes: string, number: number) {
  const shapes = readShapes(xml);
  const subtitleShape = shapes.find((shape) => shape.subtitle);
  const titleShape = shapes.find((shape) => shape.title) ?? shapes.find((shape) => !shape.skip && shape !== subtitleShape && shape.paragraphs.length > 0);
  const title = titleShape?.paragraphs[0]?.text ?? "";
  const subtitle = subtitleShape?.paragraphs.map((item) => item.text).join(" ") ?? "";
  const blocks: Array<{ type: "bullets"; items: { text: string }[] } | { type: "paragraph"; text: string }> = [];
  const bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push({ type: "bullets", items: bullets.splice(0).map((text) => ({ text })) });
  };
  const consume = (paragraphs: Paragraph[]) => {
    for (const paragraph of paragraphs) {
      if (paragraph.bullet) bullets.push(paragraph.text);
      else {
        flush();
        blocks.push({ type: "paragraph", text: paragraph.text });
      }
    }
  };
  for (const shape of shapes) {
    if (shape.skip || shape === subtitleShape) continue;
    consume(shape === titleShape ? shape.paragraphs.slice(1) : shape.paragraphs);
  }
  flush();
  if (!title && blocks.length === 0 && !notes) return null;
  if (!title) throw new Error(`Slide ${number} has notes or body text but no title.`);
  return {
    id: `slide-${number}`,
    title,
    layout: blocks.length > 0 ? "content" : "title",
    ...(subtitle ? { subtitle } : {}),
    ...(notes ? { notes } : {}),
    ...(blocks.length > 0 ? { blocks } : {}),
  };
}

async function notesText(zip: JSZip, slidePath: string): Promise<string> {
  const relsPath = relsFor(slidePath);
  const relsFile = zip.file(relsPath);
  if (!relsFile) return "";
  const rels = await relsFile.async("string");
  const match = /Type="[^"]*\/notesSlide"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Type="[^"]*\/notesSlide"/.exec(rels);
  const target = match?.[1] || match?.[2];
  if (!target) return "";
  const notesPath = normalizeTarget(slidePath.slice(0, slidePath.lastIndexOf("/")), target);
  const notes = await textFile(zip, notesPath);
  const lines = readShapes(notes)
    .filter((shape) => !shape.skip)
    .flatMap((shape) => shape.paragraphs.map((item) => item.text));
  return lines.join("\n").trim();
}

function readShapes(xml: string): Shape[] {
  return shapes(xml).map((shape) => ({
    title: /<p:ph[^>]*type="(?:title|ctrTitle)"/.test(shape),
    subtitle: /<p:ph[^>]*type="subTitle"/.test(shape),
    skip: /<p:ph[^>]*type="(?:sldNum|sldImg|hdr|ftr|dt)"/.test(shape),
    paragraphs: paragraphs(shape),
  }));
}

function shapes(xml: string): string[] {
  const found: string[] = [];
  const marker = /<p:sp[ >]/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(xml))) {
    const end = xml.indexOf("</p:sp>", match.index);
    if (end < 0) throw new Error("A PowerPoint shape was cut off.");
    found.push(xml.slice(match.index, end + "</p:sp>".length));
  }
  return found;
}

function paragraphs(shape: string): Paragraph[] {
  const found: Paragraph[] = [];
  const marker = /<a:p[ >]/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(shape))) {
    const end = shape.indexOf("</a:p>", match.index);
    if (end < 0) throw new Error("A PowerPoint paragraph was cut off.");
    const body = shape.slice(match.index, end);
    const text = [...body.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((item) => decodeXml(item[1] ?? "")).join("").trim();
    if (!text) continue;
    const bullet = /<a:bu(?:Char|AutoNum|Font)\b/.test(body) && !/<a:buNone\b/.test(body);
    found.push({ text, bullet });
  }
  return found;
}

function slideTargets(presentation: string, rels: string): string[] {
  const ids = [...presentation.matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((item) => item[1] ?? "");
  return ids.map((id) => {
    const pattern = new RegExp(`Id="${id}"[^>]*Type="[^"]*/slide"[^>]*Target="([^"]+)"|Id="${id}"[^>]*Target="([^"]+)"[^>]*Type="[^"]*/slide"`);
    const match = pattern.exec(rels);
    const target = match?.[1] || match?.[2];
    if (!target) throw new Error(`The PowerPoint slide list names ${id}, but that slide is missing.`);
    return target;
  });
}

async function coreTitle(zip: JSZip): Promise<string> {
  const core = zip.file("docProps/core.xml");
  if (!core) return "";
  const xml = await core.async("string");
  const match = /<dc:title[^>]*>([^<]*)<\/dc:title>/.exec(xml);
  return decodeXml(match?.[1] ?? "").trim();
}

async function textFile(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`This PowerPoint is missing ${path}.`);
  return file.async("string");
}

function relsFor(path: string): string {
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash);
  const name = path.slice(slash + 1);
  return `${dir}/_rels/${name}.rels`;
}

function normalizeTarget(base: string, target: string): string {
  const parts = base.split("/").filter(Boolean);
  for (const segment of target.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return parts.join("/");
}

function deckId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  if (/^[a-z0-9]/.test(slug)) return slug;
  return "imported-deck";
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num: string) => String.fromCodePoint(Number(num)))
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}
