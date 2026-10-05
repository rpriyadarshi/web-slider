import PptxGenJS from "pptxgenjs";
import { resolveBrand } from "../brand/kit";
import { isDarkHex } from "../highlight";
import type { Deck, Slide } from "../model/schema";
import { resolveTheme, titleSize } from "../model/schema";
import type { DeckSession } from "../model/session";
import { blocksToText, imageBlocks, widgetToText } from "../model/text";
import { bytesToBlob } from "./blob";
import { fitBox, loadBrandMark, loadRaster } from "./images";

const WIDTH = 13.333;
const HEIGHT = 7.5;

export async function buildPptx(deck: Deck, session: DeckSession): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "DECK", width: WIDTH, height: HEIGHT });
  pptx.layout = "DECK";
  pptx.title = deck.title;
  if (deck.author) pptx.author = deck.author;

  for (const slide of deck.slides.filter((item) => !item.hidden)) {
    await addSlide(pptx, deck, slide, session);
  }

  const output = await pptx.write({ outputType: "uint8array" });
  if (!(output instanceof Uint8Array)) {
    throw new Error("PowerPoint export did not return a file.");
  }
  return bytesToBlob(output, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
}

async function addSlide(pptx: PptxGenJS, deck: Deck, slide: Slide, session: DeckSession): Promise<void> {
  const theme = resolveTheme(deck.theme, slide.theme);
  const page = pptx.addSlide();
  page.background = { color: plain(theme.background) };

  const images = [...imageBlocks(slide.blocks), ...imageBlocks(slide.side)];
  const widgets = slide.widgets ?? [];
  const widgetText = widgets.map((widget) => widgetToText(widget, session.answers[slide.id]?.[widget.id])).join("\n\n");
  const imageBand = images.length > 0 ? 2.15 : 0;
  const widgetBand = widgetText ? 1.15 : 0;
  const contentBottom = HEIGHT - 0.35 - imageBand - widgetBand;
  let y = 0.38;

  page.addText(slide.title, {
    x: 0.5,
    y,
    w: WIDTH - 1,
    h: 0.72,
    fontFace: theme.fontHeading,
    fontSize: Math.round(titleSize(theme, slide.layout)),
    color: plain(theme.text),
    bold: true,
    margin: 0,
    valign: "top",
  });
  y += 0.78;

  if (slide.subtitle) {
    page.addText(slide.subtitle, {
      x: 0.5,
      y,
      w: WIDTH - 1,
      h: 0.36,
      fontFace: theme.fontBody,
      fontSize: Math.round(theme.type.sub),
      color: plain(theme.muted),
      margin: 0,
    });
    y += 0.4;
  }

  const body = blocksToText(slide.blocks);
  const side = blocksToText(slide.side);
  const textHeight = Math.max(0.8, contentBottom - y);
  if (side) {
    page.addText(body || " ", {
      x: 0.5,
      y,
      w: 7.5,
      h: textHeight,
      fontFace: theme.fontBody,
      fontSize: Math.round(theme.type.body),
      color: plain(theme.text),
      valign: "top",
      fit: "shrink",
      margin: 0,
    });
    page.addText(side, {
      x: 8.2,
      y,
      w: 4.6,
      h: textHeight,
      fontFace: theme.fontMono,
      fontSize: 12,
      color: plain(theme.text),
      valign: "top",
      fit: "shrink",
      margin: 0,
    });
  } else if (body) {
    page.addText(body, {
      x: 0.5,
      y,
      w: WIDTH - 1,
      h: textHeight,
      fontFace: theme.fontBody,
      fontSize: Math.round(theme.type.body),
      color: plain(theme.text),
      align: slide.layout === "content" ? theme.align : "center",
      valign: "top",
      fit: "shrink",
      margin: 0,
    });
  }

  if (images.length > 0) {
    const bandY = HEIGHT - 0.32 - widgetBand - imageBand;
    const slot = (WIDTH - 1) / images.length;
    for (const [index, block] of images.entries()) {
      let image;
      try {
        image = await loadRaster(block.src);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Slide "${slide.id}": ${message}`);
      }
      const box = fitBox(image.width, image.height, (slot - 0.16) * 96, imageBand * 96);
      const w = box.width / 96;
      const h = box.height / 96;
      const data = toPptxData(image.bytes, image.mime);
      page.addImage({
        data,
        x: 0.5 + index * slot + (slot - w) / 2,
        y: bandY + (imageBand - h) / 2,
        w,
        h,
      });
    }
  }

  if (widgetText) {
    page.addText(widgetText, {
      x: 0.5,
      y: HEIGHT - 0.28 - widgetBand,
      w: WIDTH - 1,
      h: widgetBand - 0.08,
      fontFace: theme.fontBody,
      fontSize: 12,
      color: plain(theme.text),
      valign: "top",
      fit: "shrink",
      margin: 0,
    });
  }

  const brand = resolveBrand(deck.brand);
  if (brand) {
    const mark = await loadBrandMark(isDarkHex(theme.background) ? brand.markDark : brand.markLight);
    let x = 0.4;
    if (mark) {
      const markInches = theme.type.mark / 96;
      page.addImage({ data: toPptxData(mark.bytes, mark.mime), x, y: HEIGHT - markInches - 0.08, w: markInches, h: markInches });
      x += markInches + 0.08;
    }
    page.addText(
      [
        { text: brand.wordmark, options: { color: plain(theme.text) } },
        ...(brand.tail ? [{ text: ` ${brand.tail}`, options: { color: plain(brand.highlight) } }] : []),
      ],
      {
        x,
        y: HEIGHT - 0.4,
        w: 4,
        h: 0.28,
        fontFace: theme.fontBody,
        fontSize: Math.round(theme.type.wordmark),
        margin: 0,
        valign: "middle",
      },
    );
  }

  const notes = [slide.notes, session.notes[slide.id] ? `Taken notes:\n${session.notes[slide.id]}` : ""]
    .filter((entry): entry is string => Boolean(entry))
    .join("\n\n");
  if (notes) page.addNotes(notes);
}

function plain(hex: string): string {
  return hex.slice(1).toUpperCase();
}

function toPptxData(bytes: Uint8Array, mime: "image/png" | "image/jpeg"): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  const type = mime === "image/png" ? "image/png" : "image/jpeg";
  return `${type};base64,${btoa(binary)}`;
}
