import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exportFile, hideScratchPath, saveExport, type ExportKind, type PickedFile, type SaveChannel } from "./saveFile";

const KINDS: ExportKind[] = ["yaml", "pdf", "docx", "pptx", "package", "runnable", "handout"];
const zip = () => new Blob(["PK zip bytes"], { type: "application/zip" });
const refused = () => {
  throw new Error("The talk names files it does not carry: diagrams/landscape.png.");
};

/** A save dialog whose file records what the export did to it. */
function dialog(file: { remove?: "works" | "missing" | "fails"; write?: "works" | "fails"; open?: "fails" } = {}) {
  const events: string[] = [];
  const written: Array<Blob | BufferSource> = [];
  const picked: PickedFile = {
    createWritable: async () => {
      events.push("open");
      if (file.open === "fails") throw new DOMException("The request is not allowed by the user agent or the platform in the current context.", "NotAllowedError");
      return {
        write: async (data: Blob | BufferSource) => {
          if (file.write === "fails") throw new Error("Disk is full.");
          written.push(data);
          events.push("write");
        },
        close: async () => {
          events.push("close");
        },
        abort: async () => {
          events.push("abort");
        },
      };
    },
  };
  if (file.remove !== "missing") {
    picked.remove = async () => {
      if (file.remove === "fails") throw new Error("NotAllowedError: The request is not allowed.");
      events.push("remove");
    };
  }
  const channel: SaveChannel = {
    picker: async (options) => {
      events.push(`pick ${options.suggestedName}`);
      return picked;
    },
    download: () => {
      throw new Error("The download must not run when the save dialog exists.");
    },
  };
  const build = (result: () => Blob) => async () => {
    events.push("build");
    return result();
  };
  return { events, written, channel, build };
}

describe("saveExport", () => {
  it("names every export file and its type", () => {
    expect(exportFile("yaml", "pd-dv")).toEqual({
      suggestedName: "pd-dv.yaml",
      types: [{ description: "YAML", accept: { "application/yaml": [".yaml"] } }],
    });
    expect(exportFile("pdf", "pd-dv").suggestedName).toBe("pd-dv.pdf");
    expect(exportFile("docx", "pd-dv").suggestedName).toBe("pd-dv.docx");
    expect(exportFile("pptx", "pd-dv").types[0]?.accept).toEqual({
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    });
    expect(exportFile("package", "pd-dv").suggestedName).toBe("pd-dv.zip");
    expect(exportFile("runnable", "pd-dv")).toEqual({
      suggestedName: "pd-dv-presenter.zip",
      types: [{ description: "Runnable package", accept: { "application/zip": [".zip"] } }],
    });
    expect(exportFile("handout", "pd-dv").suggestedName).toBe("pd-dv-handout.docx");
  });

  it("stops without building when the dialog is cancelled", async () => {
    const { events, build } = dialog();
    const channel: SaveChannel = {
      picker: async () => {
        const error = new Error("The user aborted a request.");
        error.name = "AbortError";
        throw error;
      },
      download: () => {
        throw new Error("The download must not run when the save dialog exists.");
      },
    };
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), build: build(zip) }, channel)).resolves.toBe("cancelled");
    expect(events).toEqual([]);
  });

  it("opens the writer before the build resolves, then writes the finished bytes once", async () => {
    const { events, written, channel, build } = dialog();
    const bytes = zip();
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), build: build(() => bytes) }, channel)).resolves.toBe("saved");
    expect(events).toEqual(["pick pd-dv-presenter.zip", "open", "build", "write", "close"]);
    expect(events.indexOf("open")).toBeLessThan(events.indexOf("build"));
    expect(events).not.toContain("abort");
    expect(written).toHaveLength(1);
    expect(written[0]).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(written[0] as Uint8Array)).toBe("PK zip bytes");
  });

  it("removes the file the dialog created when the build fails", async () => {
    const { events, written, channel, build } = dialog();
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), build: build(refused) }, channel)).rejects.toThrow(
      /^The talk names files it does not carry: diagrams\/landscape\.png\.$/,
    );
    expect(events).toEqual(["pick pd-dv-presenter.zip", "open", "build", "remove"]);
    expect(events).not.toContain("abort");
    expect(written).toEqual([]);
  });

  it("never writes an empty export", async () => {
    const { events, written, channel, build } = dialog();
    await expect(saveExport({ ...exportFile("package", "pd-dv"), build: build(() => new Blob([])) }, channel)).rejects.toThrow(
      /^pd-dv\.zip came out empty, so nothing was saved\.$/,
    );
    expect(events).toEqual(["pick pd-dv.zip", "open", "build", "remove"]);
    expect(events).not.toContain("abort");
    expect(written).toEqual([]);
  });

  it("removes the dialog file when writing fails and does not abort", async () => {
    const { events, channel, build } = dialog({ write: "fails" });
    await expect(saveExport({ ...exportFile("pdf", "pd-dv"), build: build(zip) }, channel)).rejects.toThrow(/^Disk is full\.$/);
    expect(events).toEqual(["pick pd-dv.pdf", "open", "build", "remove"]);
    expect(events).not.toContain("abort");
  });

  it("names the empty file when the browser cannot delete it", async () => {
    const missing = dialog({ remove: "missing" });
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), build: missing.build(refused) }, missing.channel)).rejects.toThrow(
      "does not carry: diagrams/landscape.png. The save dialog had already created pd-dv-presenter.zip, and this browser cannot delete it. It is empty; delete it.",
    );
    const denied = dialog({ remove: "fails" });
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), build: denied.build(refused) }, denied.channel)).rejects.toThrow(
      "pd-dv-presenter.zip, and it could not be deleted (NotAllowedError: The request is not allowed.). It is empty; delete it.",
    );
  });

  it("refuses before the dialog opens when the check fails", async () => {
    const { events, channel, build } = dialog();
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), check: refused, build: build(zip) }, channel)).rejects.toThrow(
      "does not carry",
    );
    expect(events).toEqual([]);
  });

  it("downloads the finished file when the dialog refuses the write", async () => {
    const downloads: Array<[Blob, string]> = [];
    const { events, written, channel, build } = dialog({ open: "fails", remove: "fails" });
    channel.download = (blob, name) => void downloads.push([blob, name]);
    const bytes = zip();
    await expect(saveExport({ ...exportFile("runnable", "pd-dv"), build: build(() => bytes) }, channel)).rejects.toThrow(
      /sent to your browser downloads/,
    );
    expect(events).toEqual(["pick pd-dv-presenter.zip", "open", "build"]);
    expect(written).toEqual([]);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.[0]).toBe(bytes);
    expect(downloads[0]?.[1]).toBe("pd-dv-presenter.zip");
  });

  it("downloads only finished bytes when the browser has no save dialog", async () => {
    const downloads: Array<[Blob, string]> = [];
    const channel: SaveChannel = { download: (blob, name) => void downloads.push([blob, name]) };
    const bytes = zip();
    await expect(saveExport({ ...exportFile("pdf", "pd-dv"), build: async () => bytes }, channel)).resolves.toBe("saved");
    await expect(saveExport({ ...exportFile("pdf", "pd-dv"), build: async () => refused() }, channel)).rejects.toThrow("does not carry");
    await expect(saveExport({ ...exportFile("pdf", "pd-dv"), build: async () => new Blob([]) }, channel)).rejects.toThrow("came out empty");
    expect(downloads).toHaveLength(1);
    expect(downloads[0]?.[0]).toBe(bytes);
    expect(downloads[0]?.[1]).toBe("pd-dv.pdf");
  });

  it("strips a scratch path from the export error and keeps the failure", () => {
    const leaked =
      "The talk names files it does not carry: diagrams/landscape.png, diagrams/architecture.png. Open the talk's .zip so those files travel with it. (/tmp/web-slider-export-4K1bz/C/deck.zip)";
    const shown = hideScratchPath(leaked);
    expect(shown).toBe(
      "The talk names files it does not carry: diagrams/landscape.png, diagrams/architecture.png. Open the talk's .zip so those files travel with it.",
    );
    expect(shown).not.toContain("/tmp");
    expect(hideScratchPath("Talk /private/tmp/web-slider-export-x/deck.zip has no deck.yaml.")).toBe("Talk has no deck.yaml.");
  });
});

describe("one export channel", () => {
  const src = fileURLToPath(new URL("..", import.meta.url));
  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sources(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });

  it("sends every Export menu item through saveExport", () => {
    const shell = readFileSync(path.join(src, "layout", "Shell.tsx"), "utf8");
    const kinds = [...shell.matchAll(/startExport\(\s*"(\w+)"/g)].map((match) => match[1]);
    expect([...kinds].sort()).toEqual([...KINDS].sort());
    expect(shell.match(/saveExport\(/g)).toHaveLength(1);
  });

  it("leaves no other way to write an export to disk", () => {
    const writers = sources(src)
      .filter((file) => /showSaveFilePicker|createWritable|\.download\s*=/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(src, file));
    expect(writers).toEqual([path.join("export", "saveFile.ts")]);
  });
});
