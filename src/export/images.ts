export type RasterImage = {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
};

export async function loadBrandMark(src: string): Promise<RasterImage | null> {
  const url = fetchableMark(src);
  try {
    return await loadRaster(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("Only PNG and JPEG")) throw error;
  }
  if (typeof document === "undefined") return null;
  const bytes = await drawSvgToPng(url);
  return { bytes, mime: "image/png", width: 128, height: 128 };
}

async function drawSvgToPng(src: string): Promise<Uint8Array> {
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    throw new Error("The brand mark could not be drawn.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The brand mark could not be drawn.");
  context.drawImage(image, 0, 0, 128, 128);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/png"));
  if (!blob) throw new Error("The brand mark could not be drawn.");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function loadRaster(src: string): Promise<RasterImage> {
  const { bytes, mimeHint } = await readImageBytes(src);
  const mime = sniffMime(bytes) ?? mimeFromHint(mimeHint);
  if (mime !== "image/png" && mime !== "image/jpeg") {
    throw new Error("Only PNG and JPEG images can be exported.");
  }
  const size = mime === "image/png" ? pngSize(bytes) : jpegSize(bytes);
  return { bytes, mime, width: size.width, height: size.height };
}

export function fitBox(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new Error("Image dimensions are invalid.");
  }
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

function fetchableMark(src: string): string {
  if (
    src.startsWith("https://") ||
    src.startsWith("http://") ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.startsWith("/")
  ) {
    return src;
  }
  return `/${src}`;
}

async function readImageBytes(src: string): Promise<{ bytes: Uint8Array; mimeHint: string | null }> {
  if (src.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(src);
    if (!match) throw new Error("Image data URI is malformed.");
    const payload = match[3] ?? "";
    if (match[2]) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return { bytes, mimeHint: match[1] ?? null };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), mimeHint: match[1] ?? null };
  }

  const response = await fetch(src);
  if (!response.ok) {
    throw new Error(`Image failed to load (${response.status}): ${src}`);
  }
  return { bytes: new Uint8Array(await response.arrayBuffer()), mimeHint: response.headers.get("content-type") };
}

function mimeFromHint(hint: string | null): string | null {
  if (!hint) return null;
  return hint.split(";")[0]?.trim().toLowerCase() ?? null;
}

function sniffMime(bytes: Uint8Array): "image/png" | "image/jpeg" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return null;
}

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24) throw new Error("PNG is truncated.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) throw new Error("JPEG is invalid.");
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (view.getUint8(offset) !== 0xff) throw new Error("JPEG is invalid.");
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    offset += 2 + length;
  }
  throw new Error("JPEG dimensions could not be read.");
}
