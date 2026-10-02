import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { Block, Deck, FontName, ResolvedTheme, Slide } from "../model/schema";
import { resolveTheme } from "../model/schema";
import type { DeckSession } from "../model/session";
import { widgetToText } from "../model/text";
import type { FontFiles } from "../theme/fonts";
import { fitBox, loadRaster } from "./images";

const PAGE_W = 960;
const PAGE_H = 540;
const MARGIN = 40;
const SCALES = [1, 0.86, 0.74];

type EmbeddedFonts = Record<FontName, { regular: PDFFont; semibold: PDFFont }>;

export async function buildPdf(deck: Deck, session: DeckSession, files: FontFiles): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(deck.title);
  if (deck.author) pdf.setAuthor(deck.author);

  const embedded = {} as EmbeddedFonts;
  for (const name of Object.keys(files) as FontName[]) {
    embedded[name] = {
      regular: await pdf.embedFont(files[name].regular, { subset: true }),
      semibold: await pdf.embedFont(files[name].semibold, { subset: true }),
    };
  }

  for (const [index, slide] of deck.slides.entries()) {
    let fitted = false;
    for (const scale of SCALES) {
      const page = pdf.addPage([PAGE_W, PAGE_H]);
      const ok = await paintSlide(pdf, page, deck, slide, session, embedded, index, scale);
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

async function paintSlide(
  pdf: PDFDocument,
  page: PDFPage,
  deck: Deck,
  slide: Slide,
  session: DeckSession,
  fonts: EmbeddedFonts,
  index: number,
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
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: colors.background });

  const heading = fonts[theme.fontHeading].semibold;
  const body = fonts[theme.fontBody].regular;
  const cursor = new Cursor(page, MARGIN, PAGE_H - MARGIN, PAGE_W - MARGIN * 2, 36);
  const centered = slide.layout !== "content" || theme.align === "center";

  cursor.text(slide.title, heading, 32 * scale * theme.headingScale, colors.text, centered, 6);
  page.drawRectangle({
    x: centered ? PAGE_W / 2 - 28 : MARGIN,
    y: cursor.y - 2,
    width: 56,
    height: 3 * scale,
    color: colors.accent,
  });
  cursor.y -= 14 * scale;
  if (slide.subtitle) cursor.text(slide.subtitle, body, 16 * scale, colors.muted, centered, 8);
  if (slide.layout === "title" && deck.author) cursor.text(deck.author, body, 13 * scale, colors.muted, true, 8);

  const quote = slide.layout === "quote" ? slide.blocks?.find((block) => block.type === "quote") : undefined;
  if (quote && quote.type === "quote") {
    cursor.text(`“${quote.text}”`, heading, 26 * scale * theme.headingScale, colors.text, true, 4);
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

  const below = new Cursor(page, MARGIN, Math.min(bodyCursor.y, hasSide ? sideCursor.y : bodyCursor.y) - 8, PAGE_W - MARGIN * 2, 32);
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

  const label = `${index + 1} / ${deck.slides.length}`;
  const labelWidth = body.widthOfTextAtSize(label, 11);
  page.drawText(label, {
    x: PAGE_W - MARGIN - labelWidth,
    y: 16,
    size: 11,
    font: body,
    color: colors.muted,
  });
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
  const body = fonts[theme.fontBody].regular;
  const mono = fonts[theme.fontMono].regular;
  const heading = fonts[theme.fontHeading].semibold;
  for (const block of blocks) {
    if (cursor.failed) return;
    if (block.type === "paragraph") {
      cursor.text(block.text, body, 15 * scale, colors.text, centered, 8);
    } else if (block.type === "bullets") {
      cursor.text(block.items.map((item) => `•  ${item.text}`).join("\n"), body, 15 * scale, colors.text, centered, 8);
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
