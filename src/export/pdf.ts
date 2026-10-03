import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { resolveBrand } from "../brand/kit";
import { isDarkHex } from "../highlight";
import type { Block, Deck, ResolvedTheme, Slide } from "../model/schema";
import { resolveTheme, titleSize } from "../model/schema";
import type { DeckSession } from "../model/session";
import { widgetToText } from "../model/text";
import type { FontFiles } from "../theme/fonts";
import type { FontName } from "../model/schema";
import { fitBox, loadBrandMark, loadRaster } from "./images";

const MARGIN = 40;
const SCALES = [1, 0.86, 0.74];

type EmbeddedFonts = Record<string, { regular: PDFFont; semibold: PDFFont }>;

export async function buildPdf(deck: Deck, session: DeckSession, files: FontFiles): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(deck.title);
  if (deck.author) pdf.setAuthor(deck.author);

  const embedded: EmbeddedFonts = {};
  for (const name of Object.keys(files) as FontName[]) {
    embedded[name] = {
      regular: await pdf.embedFont(files[name].regular, { subset: true }),
      semibold: await pdf.embedFont(files[name].semibold, { subset: true }),
    };
  }

  const visible = deck.slides.filter((slide) => !slide.hidden);
  const pageWidth = 960;
  const pageHeight = (deck.aspect ?? "16:9") === "4:3" ? 720 : 540;
  for (const [index, slide] of visible.entries()) {
    let fitted = false;
    for (const scale of SCALES) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      const ok = await paintSlide(pdf, page, deck, slide, session, embedded, index, visible.length, scale);
      if (ok) {
        fitted = true;
        break;
      }
      pdf.removePage(pdf.getPageCount() - 1);
    }
    if (!fitted) {
      throw new Error(`Slide "${slide.id}" does not fit on one PDF page.`);
    }
  }

  return pdf.save();
}

function fontFace(fonts: EmbeddedFonts, name: string): { regular: PDFFont; semibold: PDFFont } {
  const face = fonts[name];
  if (!face) {
    throw new Error(`Font "${name}" is not available for PDF export. Add it under fonts in the deck, or use Inter, Source Serif 4, or JetBrains Mono.`);
  }
  return face;
}

async function paintSlide(
  pdf: PDFDocument,
  page: PDFPage,
  deck: Deck,
  slide: Slide,
  session: DeckSession,
  fonts: EmbeddedFonts,
  index: number,
  total: number,
  scale: number,
): Promise<boolean> {
  const theme = resolveTheme(deck.theme, slide.theme);
  const colors = {
    background: pdfColor(theme.background),
    surface: pdfColor(theme.surface),
    text: pdfColor(theme.text),
    muted: pdfColor(theme.muted),
    accent: pdfColor(theme.accent),
  };
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: colors.background });

  const heading = fontFace(fonts, theme.fontHeading).semibold;
  const body = fontFace(fonts, theme.fontBody).regular;
  const cursor = new Cursor(page, MARGIN, pageHeight - MARGIN, pageWidth - MARGIN * 2, 36);
  const centered = slide.layout !== "content" || theme.align === "center";

  cursor.text(slide.title, heading, titleSize(theme, slide.layout) * scale, colors.text, centered, 6);
  page.drawRectangle({
    x: centered ? pageWidth / 2 - 28 : MARGIN,
    y: cursor.y - 2,
    width: 56,
    height: 3 * scale,
    color: colors.accent,
  });
  cursor.y -= 14 * scale;
  if (slide.subtitle) cursor.text(slide.subtitle, body, theme.type.sub * scale, colors.muted, centered, 8);
  if (slide.layout === "title" && deck.author) cursor.text(deck.author, body, theme.type.author * scale, colors.muted, true, 8);

  const quote = slide.layout === "quote" ? slide.blocks?.find((block) => block.type === "quote") : undefined;
  if (quote && quote.type === "quote") {
    cursor.text(`“${quote.text}”`, heading, titleSize(theme, "quote") * scale, colors.text, true, 4);
    if (quote.attribution) cursor.text(quote.attribution, body, 13 * scale, colors.muted, true, 10);
  }

  const hasSide = (slide.side?.length ?? 0) > 0;
  const gap = 22;
  const sideWidth = hasSide ? cursor.width * 0.34 : 0;
  const bodyWidth = hasSide ? cursor.width - sideWidth - gap : cursor.width;
  const bodyCursor = new Cursor(page, cursor.x, cursor.y, bodyWidth, 36);
  const sideCursor = new Cursor(page, cursor.x + bodyWidth + gap, cursor.y, sideWidth, 36);
  const bodyBlocks = (slide.blocks ?? []).filter((block) => block !== quote);

  await drawBlocks(pdf, bodyCursor, bodyBlocks, theme, fonts, colors, scale, centered && !hasSide);
  if (hasSide) await drawBlocks(pdf, sideCursor, slide.side ?? [], theme, fonts, colors, scale, false);
  if (bodyCursor.failed || sideCursor.failed) return false;

  const below = new Cursor(page, MARGIN, Math.min(bodyCursor.y, hasSide ? sideCursor.y : bodyCursor.y) - 8, pageWidth - MARGIN * 2, 32);
  const widgets = slide.widgets ?? [];
  if (widgets.length > 0) {
    below.text("Decisions", heading, 11 * scale, colors.accent, false, 4);
    for (const widget of widgets) {
      below.text(widgetToText(widget, session.answers[slide.id]?.[widget.id]), body, 12 * scale, colors.text, false, 4);
    }
  }
  if (slide.notes) below.text(`Script: ${slide.notes}`, body, 11 * scale, colors.muted, false, 3);
  const taken = session.notes[slide.id];
  if (taken) below.text(`Taken notes: ${taken}`, body, 11 * scale, colors.muted, false, 3);
  if (below.failed) return false;

  let footerX = MARGIN;
  const brand = resolveBrand(deck.brand);
  if (brand) {
    const mark = await loadBrandMark(isDarkHex(theme.background) ? brand.markDark : brand.markLight);
    if (mark) {
      const image = mark.mime === "image/png" ? await pdf.embedPng(mark.bytes) : await pdf.embedJpg(mark.bytes);
      const markSize = theme.type.mark * scale;
      page.drawImage(image, { x: footerX, y: 8, width: markSize, height: markSize });
      footerX += markSize + 4;
    }
    page.drawText(brand.wordmark, { x: footerX, y: 12, size: theme.type.wordmark, font: body, color: colors.text });
    footerX += body.widthOfTextAtSize(brand.wordmark, theme.type.wordmark);
    if (brand.tail) {
      const tail = ` ${brand.tail}`;
      page.drawText(tail, { x: footerX, y: 12, size: theme.type.wordmark, font: body, color: pdfColor(brand.highlight) });
      footerX += body.widthOfTextAtSize(tail, theme.type.wordmark);
    }
    footerX += 14;
  }
  if (deck.footer) {
    page.drawText(deck.footer, {
      x: footerX,
      y: 12,
      size: theme.type.footer,
      font: body,
      color: colors.muted,
    });
  }
  if (deck.showSlideNumber !== false) {
    const label = `${index + 1} / ${total}`;
    const labelWidth = body.widthOfTextAtSize(label, theme.type.footer);
    page.drawText(label, {
      x: pageWidth - MARGIN - labelWidth,
      y: 16,
      size: theme.type.footer,
      font: body,
      color: colors.muted,
    });
  }
  return true;
}

async function drawBlocks(
  pdf: PDFDocument,
  cursor: Cursor,
  blocks: Block[],
  theme: ResolvedTheme,
  fonts: EmbeddedFonts,
  colors: Record<"background" | "surface" | "text" | "muted" | "accent", RGB>,
  scale: number,
  centered: boolean,
): Promise<void> {
  const body = fontFace(fonts, theme.fontBody).regular;
  const mono = fontFace(fonts, theme.fontMono).regular;
  const heading = fontFace(fonts, theme.fontHeading).semibold;
  for (const block of blocks) {
    if (cursor.failed) return;
    if (block.type === "paragraph") {
      cursor.text(block.text, body, theme.type.body * scale, colors.text, centered, 8);
    } else if (block.type === "bullets" || block.type === "numbered") {
      const marker = (item: { text: string }, itemIndex: number) =>
        block.type === "numbered" ? `${itemIndex + 1}.  ${item.text}` : `•  ${item.text}`;
      cursor.text(block.items.map(marker).join("\n"), body, theme.type.body * scale, colors.text, centered, 8);
    } else if (block.type === "table") {
      cursor.text([block.headers.join("  "), ...block.rows.map((row) => row.join("  "))].join("\n"), body, theme.type.table * scale, colors.text, false, 8);
    } else if (block.type === "link") {
      cursor.text(block.href ? `${block.text}  ${block.href}` : block.text, body, 14 * scale, colors.accent, centered, 8);
    } else if (block.type === "video") {
      cursor.text(block.title ? `Video: ${block.title}` : "Video", body, 14 * scale, colors.text, centered, 2);
      cursor.text(block.src, body, 11 * scale, colors.accent, centered, 8);
    } else if (block.type === "chart") {
      drawChart(cursor, block, body, colors, scale);
    } else if (block.type === "quote") {
      cursor.text(`“${block.text}”`, heading, 18 * scale, colors.text, centered, 2);
      if (block.attribution) cursor.text(block.attribution, body, 12 * scale, colors.muted, centered, 8);
    } else if (block.type === "callout") {
      cursor.panel(block.text, body, 13 * scale, colors.text, colors.surface, colors.accent, 8);
    } else if (block.type === "code") {
      cursor.panel(block.code.replace(/\s+$/, ""), mono, 11 * scale, colors.text, colors.surface, null, 8);
    } else if (block.type === "divider") {
      if (cursor.y - 12 < cursor.bottom) {
        cursor.failed = true;
        return;
      }
      cursor.page.drawRectangle({
        x: cursor.x,
        y: cursor.y - 8,
        width: cursor.width,
        height: 1,
        color: colors.muted,
      });
      cursor.y -= 16;
    } else if (block.type === "image") {
      let image;
      try {
        image = await loadRaster(block.src);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Slide image failed: ${message}`);
      }
      const embedded = image.mime === "image/png" ? await pdf.embedPng(image.bytes) : await pdf.embedJpg(image.bytes);
      const box = fitBox(image.width, image.height, cursor.width, 150 * scale);
      if (cursor.y - box.height < cursor.bottom) {
        cursor.failed = true;
        return;
      }
      const x = centered ? cursor.x + (cursor.width - box.width) / 2 : cursor.x;
      cursor.page.drawImage(embedded, { x, y: cursor.y - box.height, width: box.width, height: box.height });
      cursor.y -= box.height + 6;
      if (block.alt) cursor.text(block.alt, body, 11 * scale, colors.muted, centered, 6);
    }
  }
}

function drawChart(
  cursor: Cursor,
  block: Extract<Block, { type: "chart" }>,
  font: PDFFont,
  colors: Record<"background" | "surface" | "text" | "muted" | "accent", RGB>,
  scale: number,
): void {
  const height = 110 * scale;
  if (cursor.y - height < cursor.bottom) {
    cursor.failed = true;
    return;
  }
  const min = Math.min(0, ...block.values);
  const max = Math.max(0, ...block.values);
  const span = max - min || 1;
  const top = cursor.y;
  const bottom = cursor.y - height;
  const zero = bottom + ((0 - min) / span) * height;
  if (block.kind === "column") {
    const slot = cursor.width / block.values.length;
    block.values.forEach((value, index) => {
      const barHeight = (Math.abs(value) / span) * height;
      const x = cursor.x + index * slot + slot * 0.18;
      const y = value >= 0 ? zero : zero - barHeight;
      cursor.page.drawRectangle({
        x,
        y,
        width: slot * 0.64,
        height: Math.max(barHeight, 0.5),
        color: colors.accent,
      });
    });
  } else {
    const slot = height / block.values.length;
    const plot = cursor.width * 0.68;
    const origin = cursor.x + cursor.width - plot + ((0 - min) / span) * plot;
    block.values.forEach((value, index) => {
      const barWidth = (Math.abs(value) / span) * plot;
      const y = top - (index + 1) * slot + slot * 0.2;
      const x = value >= 0 ? origin : origin - barWidth;
      cursor.page.drawRectangle({
        x,
        y,
        width: Math.max(barWidth, 0.5),
        height: slot * 0.6,
        color: colors.accent,
      });
    });
  }
  cursor.y = bottom - 4;
  cursor.text(block.labels.join("   "), font, 10 * scale, colors.muted, false, 6);
}

class Cursor {
  failed = false;

  constructor(
    readonly page: PDFPage,
    public x: number,
    public y: number,
    public width: number,
    readonly bottom: number,
  ) {}

  text(text: string, font: PDFFont, size: number, color: RGB, centered: boolean, gap: number): void {
    if (this.failed) return;
    const lines = wrap(text, font, size, this.width);
    for (const line of lines) {
      const baseline = this.y - size;
      if (baseline < this.bottom) {
        this.failed = true;
        return;
      }
      if (line) {
        const lineWidth = font.widthOfTextAtSize(line, size);
        const x = centered ? this.x + Math.max(0, (this.width - lineWidth) / 2) : this.x;
        this.page.drawText(line, { x, y: baseline, size, font, color });
      }
      this.y = baseline - size * 0.4;
    }
    this.y -= gap;
  }

  panel(
    text: string,
    font: PDFFont,
    size: number,
    color: RGB,
    background: RGB,
    accent: RGB | null,
    gap: number,
  ): void {
    if (this.failed) return;
    const innerWidth = this.width - 20;
    const lines = wrap(text, font, size, innerWidth);
    const lineHeight = size * 1.4;
    const height = lines.length * lineHeight + 12;
    if (this.y - height < this.bottom) {
      this.failed = true;
      return;
    }
    this.page.drawRectangle({
      x: this.x,
      y: this.y - height,
      width: this.width,
      height,
      color: background,
    });
    if (accent) {
      this.page.drawRectangle({ x: this.x, y: this.y - height, width: 4, height, color: accent });
    }
    let baseline = this.y - 8 - size;
    for (const line of lines) {
      if (line) this.page.drawText(line, { x: this.x + 12, y: baseline, size, font, color });
      baseline -= lineHeight;
    }
    this.y -= height + gap;
  }
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      let piece = "";
      for (const char of word) {
        const next = piece + char;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          piece = next;
        } else {
          if (piece) lines.push(piece);
          piece = char;
        }
      }
      current = piece;
    }
    if (current) lines.push(current);
  }
  return lines;
}

function pdfColor(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}
