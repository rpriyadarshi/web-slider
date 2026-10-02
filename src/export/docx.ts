import {
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block, Deck, ResolvedTheme, Slide } from "../model/schema";
import { resolveTheme } from "../model/schema";
import type { DeckSession } from "../model/session";
import { blockToText, widgetToText } from "../model/text";
import { fitBox, loadRaster } from "./images";

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;

export async function buildDocx(deck: Deck, session: DeckSession): Promise<Blob> {
  const theme = resolveTheme(deck.theme);
  const sections = [];
  for (const slide of deck.slides) {
    sections.push(await sectionForSlide(deck, slide, session));
  }

  const document = new Document({
    title: deck.title,
    creator: deck.author,
    background: { color: plain(theme.background) },
    sections,
  });
  return Packer.toBlob(document);
}

async function sectionForSlide(deck: Deck, slide: Slide, session: DeckSession) {
  const theme = resolveTheme(deck.theme, slide.theme);
  const paragraphs: Paragraph[] = [
    paragraph(slide.title, theme.fontHeading, 36, theme.text, true),
  ];
  if (slide.subtitle) paragraphs.push(paragraph(slide.subtitle, theme.fontBody, 18, theme.muted, false));
  if (slide.layout === "title" && deck.author) paragraphs.push(paragraph(deck.author, theme.fontBody, 14, theme.muted, false));

  paragraphs.push(...(await blockParagraphs(slide.blocks ?? [], theme)));
  if (slide.side?.length) {
    paragraphs.push(paragraph("Examples", theme.fontHeading, 16, theme.accent, true));
    paragraphs.push(...(await blockParagraphs(slide.side, theme)));
  }
  if (slide.widgets?.length) {
    paragraphs.push(paragraph("Decisions", theme.fontHeading, 16, theme.accent, true));
    for (const widget of slide.widgets) {
      paragraphs.push(
        ...lines(widgetToText(widget, session.answers[slide.id]?.[widget.id]), theme.fontBody, 14, theme.text, false),
      );
    }
  }
  if (slide.notes) {
    paragraphs.push(paragraph("Script", theme.fontHeading, 14, theme.accent, true));
    paragraphs.push(...lines(slide.notes, theme.fontBody, 13, theme.muted, false));
  }
  const taken = session.notes[slide.id];
  if (taken) {
    paragraphs.push(paragraph("Taken notes", theme.fontHeading, 14, theme.accent, true));
    paragraphs.push(...lines(taken, theme.fontBody, 13, theme.text, false));
  }

  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: 13680, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: plain(theme.background) },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            children: paragraphs,
          }),
        ],
      }),
    ],
  });

  return {
    properties: {
      page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: 720, bottom: 720, left: 720, right: 720 },
      },
    },
    children: [table],
  };
}

async function blockParagraphs(blocks: Block[], theme: ResolvedTheme): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];
  for (const block of blocks) {
    if (block.type === "image") {
      let image;
      try {
        image = await loadRaster(block.src);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Slide image failed: ${message}`);
      }
      const box = fitBox(image.width, image.height, 620, 280);
      paragraphs.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: image.mime === "image/png" ? "png" : "jpg",
              data: image.bytes,
              transformation: { width: Math.round(box.width), height: Math.round(box.height) },
            }),
          ],
        }),
      );
      if (block.alt) paragraphs.push(paragraph(block.alt, theme.fontBody, 12, theme.muted, false));
      continue;
    }
    if (block.type === "code") {
      paragraphs.push(...lines(block.code.replace(/\s+$/, ""), theme.fontMono, 12, theme.text, false));
      continue;
    }
    const text = blockToText(block);
    if (!text) continue;
    const font = block.type === "quote" ? theme.fontHeading : theme.fontBody;
    paragraphs.push(...lines(text, font, block.type === "quote" ? 20 : 16, theme.text, false));
  }
  return paragraphs;
}

function paragraph(text: string, font: string, points: number, color: string, bold: boolean): Paragraph {
  return new Paragraph({
    spacing: { after: 120 },
    children: [run(text, font, points, color, bold)],
  });
}

function lines(text: string, font: string, points: number, color: string, bold: boolean): Paragraph[] {
  return text.split("\n").map((line) => paragraph(line.length > 0 ? line : " ", font, points, color, bold));
}

function run(text: string, font: string, points: number, color: string, bold: boolean): TextRun {
  return new TextRun({ text, font, size: points * 2, color: plain(color), bold });
}

function plain(hex: string): string {
  return hex.slice(1).toUpperCase();
}
