import JSZip from "jszip";
import YAML from "js-yaml";

type Tone = "accent" | "highlight" | "muted" | "inverse";
type Panel = "inverse" | "accent" | "highlight" | "deep" | "wash" | "band";
type Run = { text: string; bold?: boolean; italic?: boolean; tone?: Tone; size?: number };
type Paragraph = {
  text: string;
  bullet: boolean;
  bold?: boolean;
  italic?: boolean;
  tone?: Tone;
  display?: boolean;
  size?: number;
  runs?: Run[];
};
type Shape = { title: boolean; subtitle: boolean; skip: boolean; paragraphs: Paragraph[] };
type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: Panel;
  ground?: boolean;
  shape?: "round" | "circle" | "rule";
  faint?: boolean;
  size?: number;
  ink?: "inverse" | "accent" | "highlight" | "deep";
  anchor?: "middle";
  align?: "center";
};
type Placed = Box & { paragraphs: Paragraph[] };
type Block =
  | {
      type: "paragraph";
      text: string;
      bold?: boolean;
      italic?: boolean;
      tone?: Tone;
      display?: boolean;
      size?: number;
      runs?: Run[];
    }
  | { type: "bullets"; items: { text: string }[] }
  | { type: "image"; src: string; alt: string };
type Picture = { x: number; y: number; w: number; h: number; src: string };
export type CompiledAsset = { path: string; bytes: Uint8Array };

const FIELD_REGION = new Set(["title", "subtitle", "author", "footer", "body", "side"]);

export async function importPptx(
  bytes: ArrayBuffer | Uint8Array,
  filename: string,
  assets?: CompiledAsset[],
): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const presentation = await textFile(zip, "ppt/presentation.xml");
  const rels = await textFile(zip, "ppt/_rels/presentation.xml.rels");
  const order = slideTargets(presentation, rels);
  if (order.length === 0) throw new Error("This PowerPoint has no slides.");
  const size = slideSize(presentation);

  const layouts: Record<string, Record<string, Box>> = {};
  const slides = [];
  for (const [index, target] of order.entries()) {
    const path = normalizeTarget("ppt", target);
    const xml = await textFile(zip, path);
    const notes = await notesText(zip, path);
    const pictures = await readPictures(zip, path, xml, size, index + 1, assets);
    const imported = slideFromXml(xml, notes, index + 1, size, pictures);
    if (!imported) continue;
    layouts[imported.layout] = imported.regions;
    slides.push({
      id: imported.id,
      title: imported.title,
      layout: imported.layout,
      ...(imported.notes ? { notes: imported.notes } : {}),
      ...(imported.blocks ? { blocks: imported.blocks } : {}),
      ...(imported.slots ? { slots: imported.slots } : {}),
    });
  }
  if (slides.length === 0) {
    throw new Error("This PowerPoint has no titles, bullets, or notes to import. Animations, pictures, and charts are left out.");
  }

  const fromFile = (await coreTitle(zip)).trim();
  const title =
    fromFile && fromFile !== "PptxGenJS Presentation" ? fromFile : filename.replace(/\.pptx$/i, "") || "Imported deck";
  const document = {
    id: deckId(title),
    title,
    layouts,
    slides,
  };
  return YAML.dump(document, { lineWidth: -1, noRefs: true });
}

function slideFromXml(xml: string, notes: string, number: number, size: { cx: number; cy: number }, pictures: Picture[]) {
  const grounds = readGrounds(xml, size).filter((ground) => ground.y < 91.5 && (ground.shape === "rule" || (ground.w >= 1.2 && ground.h >= 1.2)));
  const placed = readPlaced(xml, size).filter((shape) => {
    if (shape.y >= 91.5) return false;
    const text = shape.paragraphs.map((item) => item.text).join("");
    if (isArrow(text)) return shape.w >= 1.2 && shape.h >= 1.2;
    return shape.w >= 3.5 && shape.h >= 1.2;
  });
  const titleShape = topWide(placed);
  const title = titleShape ? titleShape.paragraphs.map((item) => item.text).join(" ") : "";
  const rest = placed.filter((shape) => shape !== titleShape);
  const keptPictures = pictures.filter((picture) => picture.y < 91.5 && picture.w >= 3.5 && picture.h >= 3.5);
  if (!title && rest.length === 0 && keptPictures.length === 0 && !notes) return null;
  if (!title) throw new Error(`Slide ${number} has notes or body text but no title.`);

  const layoutName = `slide-${number}`;
  const regions: Record<string, Box> = {};
  if (titleShape) {
    const titleSize = titleShape.paragraphs.find((item) => item.size)?.size;
    regions.title = {
      x: titleShape.x,
      y: titleShape.y,
      w: titleShape.w,
      h: titleShape.h,
      ...(titleSize ? { size: titleSize } : {}),
    };
  }
  const used = new Set<string>(["title"]);
  const slots: Record<string, Block[]> = {};
  let blocks: Block[] | undefined;
  grounds.forEach((ground, index) => {
    const name = freshName("ground", index, used);
    regions[name] = {
      x: ground.x,
      y: ground.y,
      w: ground.w,
      h: ground.h,
      tone: ground.tone,
      ground: true,
      ...(ground.faint ? { faint: true } : {}),
      ...(ground.shape ? { shape: ground.shape } : {}),
    };
  });
  const alone = rest.length === 1 && keptPictures.length === 0 && grounds.length === 0 ? rest[0] : undefined;
  if (alone) {
    regions.body = {
      x: alone.x,
      y: alone.y,
      w: alone.w,
      h: alone.h,
      ...(alone.anchor ? { anchor: alone.anchor } : {}),
      ...(alone.align ? { align: alone.align } : {}),
    };
    blocks = blocksFrom(alone.paragraphs);
    used.add("body");
  } else {
    rest.forEach((shape, index) => {
      const name = regionName(shape.paragraphs, index, used);
      const ink = coveringInk(shape, grounds);
      regions[name] = {
        x: shape.x,
        y: shape.y,
        w: shape.w,
        h: shape.h,
        ...(ink ? { ink } : {}),
        ...(shape.anchor ? { anchor: shape.anchor } : {}),
        ...(shape.align ? { align: shape.align } : {}),
      };
      const piece = blocksFrom(shape.paragraphs);
      if (piece.length > 0) slots[name] = piece;
    });
  }
  keptPictures.forEach((picture, index) => {
    const name = freshName("picture", index, used);
    regions[name] = { x: picture.x, y: picture.y, w: picture.w, h: picture.h };
    slots[name] = [{ type: "image", src: picture.src, alt: "Picture from the source slide" }];
  });
  separateOverlaps(regions, number);
  const contentBottom = Math.max(0, ...Object.values(regions).filter((box) => !box.ground).map((box) => box.y + box.h));
  if (contentBottom <= 90) regions.footer = { x: 4, y: 93, w: 92, h: 6 };
  separateOverlaps(regions, number);

  return {
    id: layoutName,
    title,
    layout: layoutName,
    regions,
    ...(notes ? { notes } : {}),
    ...(blocks && blocks.length > 0 ? { blocks } : {}),
    ...(Object.keys(slots).length > 0 ? { slots } : {}),
  };
}

function slideSize(presentation: string): { cx: number; cy: number } {
  const tag = /<p:sldSz\b[^>]*>/.exec(presentation)?.[0] ?? "";
  const cx = Number(/cx="(\d+)"/.exec(tag)?.[1] ?? 12192000);
  const cy = Number(/cy="(\d+)"/.exec(tag)?.[1] ?? 6858000);
  if (!(cx > 0) || !(cy > 0)) throw new Error("This PowerPoint has no slide size.");
  return { cx, cy };
}

function readPlaced(xml: string, size: { cx: number; cy: number }): Placed[] {
  const found: Placed[] = [];
  const marker = /<p:sp(?:\s|>)/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(xml))) {
    const end = xml.indexOf("</p:sp>", match.index);
    if (end < 0) throw new Error("A PowerPoint shape was cut off.");
    const shape = xml.slice(match.index, end + "</p:sp>".length);
    if (/<p:ph[^>]*type="(?:sldNum|sldImg|hdr|ftr|dt)"/.test(shape)) continue;
    const paragraphsInShape = paragraphs(shape);
    if (paragraphsInShape.length === 0) continue;
    const box = shapeBox(shape, size);
    if (!box) continue;
    const anchor = /<a:bodyPr[^>]*\banchor="ctr"/.test(shape) ? ("middle" as const) : undefined;
    const align = /<a:pPr[^>]*\balgn="ctr"/.test(shape) ? ("center" as const) : undefined;
    found.push({ ...box, ...(anchor ? { anchor } : {}), ...(align ? { align } : {}), paragraphs: paragraphsInShape });
  }
  return found;
}

function readGrounds(xml: string, size: { cx: number; cy: number }): Box[] {
  const panels: Box[] = [];
  const marker = /<p:sp(?:\s|>)/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(xml))) {
    const end = xml.indexOf("</p:sp>", match.index);
    if (end < 0) continue;
    const shape = xml.slice(match.index, end + "</p:sp>".length);
    const props = /<p:spPr>([\s\S]*?)<\/p:spPr>/.exec(shape)?.[1] ?? "";
    if (/prst="line"/.test(props)) {
      const rule = ruleBox(shape, size);
      if (rule) panels.push(rule);
      continue;
    }
    const fill = /<a:solidFill>[\s\S]*?<a:srgbClr val="([0-9A-Fa-f]{6})"([^>]*\/>|[^>]*>[\s\S]*?<\/a:srgbClr>)/.exec(props);
    const tone = fill ? panelTone(fill[1] ?? "") : null;
    if (!tone) continue;
    const alpha = Number(/<a:alpha val="(\d+)"/.exec(fill?.[2] ?? "")?.[1] ?? 100000);
    const box = shapeBox(shape, size);
    if (!box) continue;
    const shapeName = shapeKind(props);
    panels.push({ ...box, tone, ...(alpha < 30000 ? { faint: true } : {}), ...(shapeName ? { shape: shapeName } : {}) });
  }
  return panels;
}

function shapeKind(props: string): "round" | "circle" | undefined {
  const preset = /<a:prstGeom[^>]*prst="([^"]+)"/.exec(props)?.[1];
  if (preset === "roundRect") return "round";
  if (preset === "ellipse") return "circle";
  return undefined;
}

function coveringInk(text: Box, grounds: Box[]): Box["ink"] {
  const hits = grounds.filter((ground) => ground.tone && !ground.faint && covers(text, ground));
  hits.sort((left, right) => left.w * left.h - right.w * right.h);
  const tone = hits[0]?.tone;
  if (!tone || tone === "wash" || tone === "band") return undefined;
  return tone;
}

async function readPictures(
  zip: JSZip,
  slidePath: string,
  xml: string,
  size: { cx: number; cy: number },
  number: number,
  assets: CompiledAsset[] | undefined,
): Promise<Picture[]> {
  const relsFile = zip.file(relsFor(slidePath));
  const rels = relsFile ? await relsFile.async("string") : "";
  const pictures: Picture[] = [];
  const marker = /<p:pic(?:\s|>)/g;
  let match: RegExpExecArray | null;
  while ((match = marker.exec(xml))) {
    const end = xml.indexOf("</p:pic>", match.index);
    if (end < 0) throw new Error("A PowerPoint picture was cut off.");
    const shape = xml.slice(match.index, end + "</p:pic>".length);
    const box = shapeBox(shape, size);
    const embed = /r:embed="([^"]+)"/.exec(shape)?.[1];
    if (!box || !embed) continue;
    const pattern = new RegExp(`Id="${embed}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${embed}"`);
    const target = pattern.exec(rels);
    const relative = target?.[1] || target?.[2];
    if (!relative) throw new Error(`Slide ${number} pictures ${embed}, but that file is missing.`);
    const mediaPath = normalizeTarget(slidePath.slice(0, slidePath.lastIndexOf("/")), relative);
    const media = zip.file(mediaPath);
    if (!media) throw new Error(`This PowerPoint is missing ${mediaPath}.`);
    const ext = /\.jpe?g$/i.test(mediaPath) ? "jpg" : "png";
    const bytes = await media.async("uint8array");
    const named = pictures.length === 0 ? `diagrams/slide-${number}.${ext}` : `diagrams/slide-${number}-${pictures.length + 1}.${ext}`;
    const src = assets ? named : dataUri(bytes, ext);
    if (assets) assets.push({ path: named, bytes });
    pictures.push({ ...box, src });
  }
  return pictures;
}

function panelTone(hex: string): Panel | null {
  switch (hex.toUpperCase()) {
    case "0E2841":
      return "inverse";
    case "156082":
      return "deep";
    case "0F9ED5":
    case "4EA72E":
      return "accent";
    case "E97132":
      return "highlight";
    case "DDEFFA":
      return "wash";
    case "F4F6F8":
      return "band";
    default:
      return null;
  }
}


function blocksFrom(items: Paragraph[]): Block[] {
  const blocks: Block[] = [];
  const bullets: string[] = [];
  const flush = () => {
    if (bullets.length === 0) return;
    blocks.push({ type: "bullets", items: bullets.splice(0).map((text) => ({ text })) });
  };
  for (const item of items) {
    if (item.bullet) bullets.push(item.text);
    else {
      flush();
      blocks.push({
        type: "paragraph",
        text: item.text,
        ...(item.bold ? { bold: true } : {}),
        ...(item.italic ? { italic: true } : {}),
        ...(item.tone ? { tone: item.tone } : {}),
        ...(item.display ? { display: true } : {}),
        ...(item.size ? { size: item.size } : {}),
        ...(item.runs ? { runs: item.runs } : {}),
      });
    }
  }
  flush();
  return blocks;
}

function freshName(prefix: string, index: number, used: Set<string>): string {
  let n = index + 1;
  let name = `${prefix}-${n}`;
  while (used.has(name) || FIELD_REGION.has(name)) {
    n += 1;
    name = `${prefix}-${n}`;
  }
  used.add(name);
  return name;
}

function regionName(items: Paragraph[], index: number, used: Set<string>): string {
  const line = items.find((item) => /[A-Za-z]/.test(item.text))?.text ?? "";
  let slug = line
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  if (!/^[a-z]/.test(slug) || FIELD_REGION.has(slug)) slug = `slot-${index + 1}`;
  let name = slug;
  let n = 2;
  while (used.has(name) || FIELD_REGION.has(name) || name.length === 0) {
    const suffix = `-${n++}`;
    name = `${slug.slice(0, 32 - suffix.length)}${suffix}`;
  }
  used.add(name);
  return name;
}

function separateOverlaps(regions: Record<string, Box>, number: number): void {
  const names = Object.keys(regions);
  for (let pass = 0; pass < 24; pass += 1) {
    let hit = false;
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const leftName = names[i];
        const rightName = names[j];
        if (!leftName || !rightName) continue;
        const left = regions[leftName];
        const right = regions[rightName];
        if (!left || !right || left.ground || right.ground || !boxOverlap(left, right)) continue;
        hit = true;
        pullApart(left, right);
      }
    }
    if (!hit) return;
  }
  throw new Error(`Slide ${number} regions still overlap after import.`);
}

function boxOverlap(left: Box, right: Box): boolean {
  return left.x < right.x + right.w && right.x < left.x + left.w && left.y < right.y + right.h && right.y < left.y + left.h;
}

function pullApart(left: Box, right: Box): void {
  const xOverlap = Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x);
  const yOverlap = Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
  const lower = left.y <= right.y ? right : left;
  const upper = lower === left ? right : left;
  const later = left.x <= right.x ? right : left;
  const earlier = later === left ? right : left;
  if (yOverlap <= xOverlap) {
    const next = round1(upper.y + upper.h + 0.1);
    lower.h = Math.max(1, round1(lower.h - (next - lower.y)));
    lower.y = next;
  } else {
    const next = round1(earlier.x + earlier.w + 0.1);
    later.w = Math.max(1, round1(later.w - (next - later.x)));
    later.x = next;
  }
  for (const box of [left, right]) {
    if (box.x < 0) box.x = 0;
    if (box.y < 0) box.y = 0;
    if (box.x + box.w > 100) box.w = round1(100 - box.x);
    if (box.y + box.h > 100) box.h = round1(100 - box.y);
  }
}

function covers(text: Box, panel: Box): boolean {
  const x = text.x + text.w / 2;
  const y = text.y + text.h / 2;
  return x >= panel.x && x <= panel.x + panel.w && y >= panel.y && y <= panel.y + panel.h;
}

function isArrow(text: string): boolean {
  return /^[→←↑↓↔]+$/.test(text.trim());
}

function ruleBox(shape: string, size: { cx: number; cy: number }): Box | null {
  const props = /<p:spPr>([\s\S]*?)<\/p:spPr>/.exec(shape)?.[1] ?? shape;
  const off = /<a:off x="(-?\d+)" y="(-?\d+)"/.exec(props);
  const ext = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(props);
  if (!off || !ext) return null;
  const box = {
    x: percent(Number(off[1]), size.cx),
    y: percent(Number(off[2]), size.cy),
    w: percent(Number(ext[1]), size.cx),
    h: percent(Number(ext[2]), size.cy),
  };
  if (box.w < 0.2) {
    box.x = round1(box.x - (0.2 - box.w) / 2);
    box.w = 0.2;
  }
  if (box.h < 0.2) {
    box.y = round1(box.y - (0.2 - box.h) / 2);
    box.h = 0.2;
  }
  if (box.y >= 91.5 || box.w <= 0 || box.h <= 0) return null;
  return { ...box, ground: true, shape: "rule" };
}

function shapeBox(shape: string, size: { cx: number; cy: number }): Box | null {
  const props = /<p:spPr>([\s\S]*?)<\/p:spPr>/.exec(shape)?.[1] ?? shape;
  const off = /<a:off x="(-?\d+)" y="(-?\d+)"/.exec(props);
  const ext = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(props);
  if (!off || !ext) return null;
  const box = {
    x: percent(Number(off[1]), size.cx),
    y: percent(Number(off[2]), size.cy),
    w: percent(Number(ext[1]), size.cx),
    h: percent(Number(ext[2]), size.cy),
  };
  if (box.x + box.w > 100) box.w = round1(100 - box.x);
  if (box.y + box.h > 100) box.h = round1(100 - box.y);
  if (box.w <= 0 || box.h <= 0) return null;
  return box;
}

function topWide(shapes: Placed[]): Placed | undefined {
  const wide = shapes.filter((shape) => shape.w >= 40);
  const pool = wide.length > 0 ? wide : shapes;
  const upper = pool.filter((shape) => shape.y < 16);
  const ranked = upper.length > 0 ? upper : pool;
  return [...ranked].sort((left, right) => right.h - left.h || left.y - right.y)[0];
}

function dataUri(bytes: Uint8Array, ext: string): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  const mime = ext === "jpg" ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${btoa(binary)}`;
}

function percent(part: number, whole: number): number {
  return round1((part / whole) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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
    const runs = [...body.matchAll(/<a:r\b[\s\S]*?<\/a:r>/g)].flatMap((item) => {
      const run = readRun(item[0]);
      return run ? [run] : [];
    });
    const text = runs.map((run) => run.text).join("").trim();
    if (!text) continue;
    const bullet = /<a:bu(?:Char|AutoNum|Font)\b/.test(body) && !/<a:buNone\b/.test(body);
    const bold = runs.length > 0 && runs.every((run) => run.bold);
    const italic = runs.length > 0 && runs.every((run) => run.italic);
    const tone = runs.every((run) => run.tone === runs[0]?.tone) ? runs[0]?.tone : undefined;
    const pointSize = runs.every((run) => run.size === runs[0]?.size) ? runs[0]?.size : undefined;
    const display = runs.some((run) => (run.size ?? 0) >= 24) && text.length <= 12;
    const mixed =
      runs.length > 1 &&
      runs.some((run) => run.bold !== runs[0]?.bold || run.italic !== runs[0]?.italic || run.tone !== runs[0]?.tone || run.size !== runs[0]?.size);
    found.push({
      text,
      bullet,
      ...(bold ? { bold: true } : {}),
      ...(italic ? { italic: true } : {}),
      ...(tone ? { tone } : {}),
      ...(pointSize ? { size: pointSize } : {}),
      ...(display ? { display: true } : {}),
      ...(mixed
        ? {
            runs: runs.map(({ text: runText, bold: runBold, italic: runItalic, tone: runTone, size: runSize }) => ({
              text: runText,
              ...(runBold ? { bold: true } : {}),
              ...(runItalic ? { italic: true } : {}),
              ...(runTone ? { tone: runTone } : {}),
              ...(runSize ? { size: runSize } : {}),
            })),
          }
        : {}),
    });
  }
  return found;
}

function readRun(xml: string): { text: string; bold?: boolean; italic?: boolean; tone?: Tone; size?: number } | null {
  const text = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((item) => decodeXml(item[1] ?? "")).join("");
  if (!text) return null;
  const hundredths = Number(/\bsz="(\d+)"/.exec(xml)?.[1] ?? 0);
  const color = /<a:srgbClr val="([0-9A-Fa-f]{6})"/.exec(xml)?.[1];
  const tone = color ? inkTone(color) : undefined;
  const size = hundredths > 0 ? Math.round(hundredths / 10) / 10 : undefined;
  return {
    text,
    ...(/\bb="1"/.test(xml) ? { bold: true } : {}),
    ...(/\bi="1"/.test(xml) ? { italic: true } : {}),
    ...(tone ? { tone } : {}),
    ...(size ? { size } : {}),
  };
}

function inkTone(hex: string): Tone | undefined {
  switch (hex.toUpperCase()) {
    case "0F9ED5":
    case "4EA72E":
      return "accent";
    case "156082":
      return "muted";
    case "E97132":
      return "highlight";
    case "5B6B79":
    case "AFC3D1":
      return "muted";
    default:
      return undefined;
  }
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
