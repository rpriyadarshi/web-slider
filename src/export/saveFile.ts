export type ExportKind = "yaml" | "pdf" | "docx" | "pptx" | "package" | "runnable" | "handout";

export type SaveFileType = { description: string; accept: Record<string, string[]> };

export type SaveExportOptions = {
  suggestedName: string;
  types: SaveFileType[];
  /** Throws to refuse the export before the save dialog opens, so a refused export never creates a file. */
  check?: () => void;
  build: () => Promise<Blob>;
};

export type SaveResult = "saved" | "cancelled";

/** The save dialog created an empty file and refused the write. The finished bytes were downloaded instead. */
export class ExportDownloaded extends Error {
  readonly filename: string;
  readonly blob: Blob;

  constructor(filename: string, blob: Blob, cause: string) {
    super(
      `${cause} The finished ${filename} was sent to your browser downloads. Use that file, and delete the empty one from the save dialog.`,
    );
    this.name = "ExportDownloaded";
    this.filename = filename;
    this.blob = blob;
  }
}

export type OpenedWritable = {
  write: (data: Blob | BufferSource) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
};

export type PickedFile = {
  createWritable: () => Promise<OpenedWritable>;
  /** FileSystemHandle.remove(), where the browser has it. */
  remove?: () => Promise<void>;
};

export type SaveChannel = {
  /** window.showSaveFilePicker, where the browser has it. */
  picker?: (options: { suggestedName: string; types: SaveFileType[] }) => Promise<PickedFile>;
  download: (blob: Blob, filename: string) => void;
};

const EXPORT_FILES: Record<ExportKind, { suffix: string; mime: string; description: string; extension: string }> = {
  yaml: { suffix: ".yaml", mime: "application/yaml", description: "YAML", extension: ".yaml" },
  pdf: { suffix: ".pdf", mime: "application/pdf", description: "PDF", extension: ".pdf" },
  docx: {
    suffix: ".docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Word",
    extension: ".docx",
  },
  pptx: {
    suffix: ".pptx",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    description: "PowerPoint",
    extension: ".pptx",
  },
  package: { suffix: ".zip", mime: "application/zip", description: "Package", extension: ".zip" },
  runnable: { suffix: "-presenter.zip", mime: "application/zip", description: "Runnable package", extension: ".zip" },
  handout: {
    suffix: "-handout.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Handout",
    extension: ".docx",
  },
};

export function exportFile(kind: ExportKind, deckId: string): Pick<SaveExportOptions, "suggestedName" | "types"> {
  const spec = EXPORT_FILES[kind];
  return {
    suggestedName: `${deckId}${spec.suffix}`,
    types: [{ description: spec.description, accept: { [spec.mime]: [spec.extension] } }],
  };
}

const SCRATCH_ROOTS = ["/private/tmp", "/tmp"];

/** Drop server scratch paths so an export error never names a temp file. */
export function hideScratchPath(message: string, roots: readonly string[] = SCRATCH_ROOTS): string {
  const ordered = [...new Set(roots.map((root) => root.replace(/\/+$/, "")).filter((root) => root.length > 1))].sort(
    (left, right) => right.length - left.length,
  );
  let text = message;
  for (const root of ordered) {
    const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\s*\\(${escaped}/[^)]*\\)`, "g"), "");
    text = text.replace(new RegExp(`${escaped}/[^\\s)'"]+`, "g"), "");
  }
  return text.replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Every export reaches disk through this. The dialog opens while the click is still a user gesture.
 * Chrome creates or truncates the chosen file when the dialog closes, and createWritable() has to
 * run in that same turn — before build() — because a long build expires the gesture and then both
 * createWritable and remove are refused. The opened writer is held across the build. The finished
 * bytes are written on that writer, then it is closed. On failure the placeholder is removed
 * while the writer is still open. Dropping the writer pipe first makes Chrome close the
 * still-empty swap onto that path, which puts a 0-byte file back after the delete. The pipe is
 * dropped only when the delete is refused, and the delete is tried again. When the browser
 * cannot remove the file, the error names it.
 */
export async function saveExport(options: SaveExportOptions, channel: SaveChannel = browserChannel()): Promise<SaveResult> {
  options.check?.();
  const { picker } = channel;
  if (!picker) {
    channel.download(await built(options), options.suggestedName);
    return "saved";
  }
  let file: PickedFile;
  try {
    file = await picker({ suggestedName: options.suggestedName, types: options.types });
  } catch (error) {
    if (isAbort(error)) return "cancelled";
    throw error;
  }
  // Same turn as the dialog. Anything awaited first expires the gesture and createWritable is refused.
  // Chrome on Linux still refuses createWritable after a successful dialog, and the dialog has already
  // truncated the chosen file. Build the bytes and download them; do not stop with only that empty file.
  let writable: OpenedWritable;
  try {
    writable = await file.createWritable();
  } catch (error) {
    const blob = await built(options);
    channel.download(blob, options.suggestedName);
    const failure = await releaseUnwritten(file, options.suggestedName, error);
    throw new ExportDownloaded(options.suggestedName, blob, failure.message);
  }
  try {
    await writable.write(await bytesOf(await built(options), options.suggestedName));
    await writable.close();
  } catch (error) {
    throw await releaseUnwritten(file, options.suggestedName, error, writable);
  }
  return "saved";
}

/** A Blob from fetch can still close as an empty file. The writer receives the bytes themselves. */
async function bytesOf(blob: Blob, name: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error(`${name} came out empty, so nothing was saved.`);
  return bytes;
}

async function built(options: SaveExportOptions): Promise<Blob> {
  const blob = await options.build();
  if (blob.size === 0) throw new Error(`${options.suggestedName} came out empty, so nothing was saved.`);
  return blob;
}

async function releaseUnwritten(file: PickedFile, name: string, error: unknown, writable?: OpenedWritable): Promise<Error> {
  const failure = error instanceof Error ? error : new Error(String(error));
  const left = `The save dialog had already created ${name}, and`;
  if (typeof file.remove !== "function") {
    return new Error(`${failure.message} ${left} this browser cannot delete it. It is empty; delete it.`);
  }
  try {
    await file.remove();
    return failure;
  } catch {
    // The open writer can refuse the delete. Drop it and delete once more.
    // Doing this first would close the empty swap onto the path.
    if (writable?.abort) await writable.abort().catch(() => undefined);
    try {
      await file.remove();
      return failure;
    } catch (again) {
      return new Error(`${failure.message} ${left} it could not be deleted (${messageOf(again)}). It is empty; delete it.`);
    }
  }
}

function browserChannel(): SaveChannel {
  // showSaveFilePicker creates the chosen file, then Chrome on this machine refuses createWritable
  // and remove. The dialog file stays empty. The download is the write that succeeds.
  return { download: downloadBlob };
}

/** Browser download. Used when the save dialog refuses the write, and from the banner button. */
export function downloadExportFile(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // The browser can still be reading the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isAbort(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
