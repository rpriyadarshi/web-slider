import { spawn } from "node:child_process";

export function zenityArgs(kind: "yaml" | "talk"): string[] {
  const patterns = kind === "talk" ? "*.yaml *.yml *.zip *.pptx" : "*.yaml *.yml";
  return ["--file-selection", "--title=Open", `--file-filter=Files | ${patterns}`];
}

export function parsePickOutput(code: number | null, stdout: string): string | null {
  if (code !== 0) return null;
  const path = stdout.trim();
  return path.startsWith("/") ? path : null;
}

/** Native dialog. Returns the absolute path, or null when the dialog is cancelled. */
export function pickFile(kind: "yaml" | "talk"): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const child = spawn("zenity", zenityArgs(kind), { env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0 && code !== 1) {
        reject(new Error(stderr.trim() || `File dialog failed (${code ?? "unknown"}).`));
        return;
      }
      resolve(parsePickOutput(code, stdout));
    });
  });
}
