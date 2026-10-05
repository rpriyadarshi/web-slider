import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { hideScratchPath } from "../export/saveFile";

export const SHARE_ROUTE = "/__slider/share";

const MAX_DECK_BYTES = 512 * 1024 * 1024;

export type ShareRouteOptions = {
  /** The `--config` the server was started with. Only an absolute config on disk names a theme the package can carry. */
  configPath: string;
  script: string;
  cwd: string;
};

/** `POST /__slider/share` with the open talk's package runs `scripts/share.mjs` and answers with the runnable zip. */
export function shareRoute(options: ShareRouteOptions) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void => {
    const url = new URL(req.url ?? "", "http://localhost");
    if (url.pathname !== SHARE_ROUTE) {
      next();
      return;
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      reply(res, 405, "Runnable package takes a POST of the open talk's package.");
      return;
    }
    if (req.headers["content-type"] !== "application/zip") {
      reply(res, 415, "Runnable package takes the open talk as application/zip.");
      return;
    }
    const refused = shareRefusal(options.configPath, url.searchParams.get("name"));
    if (refused) {
      reply(res, 400, refused);
      return;
    }
    const name = `${url.searchParams.get("name")}-presenter`;
    void buildShare(req, name, options).then(
      (bytes) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${name}.zip"`);
        res.end(bytes);
      },
      (error: unknown) => reply(res, 500, exportErrorText(error instanceof Error ? error.message : String(error))),
    );
  };
}

/** Export failures stay loud, without the server scratch directory. */
export function exportErrorText(message: string): string {
  return hideScratchPath(message, [os.tmpdir(), "/tmp", "/private/tmp"]);
}

export function shareRefusal(configPath: string, name: string | null): string | null {
  if (!path.isAbsolute(configPath) || !/\.ya?ml$/.test(configPath)) {
    const started = configPath ? `--config ${configPath}` : "no --config";
    return `Runnable package needs a theme on disk. Start the server with --config /absolute/path/to/web-slider.config.yaml; this one was started with ${started}.`;
  }
  if (!name || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    return `Runnable package needs the talk id as its name; "${name ?? ""}" is not a file name.`;
  }
  return null;
}

async function buildShare(req: IncomingMessage, name: string, options: ShareRouteOptions): Promise<Buffer> {
  const body = await readBody(req);
  if (body.byteLength === 0) throw new Error("Runnable package received no talk.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "web-slider-export-"));
  try {
    const deck = path.join(dir, "deck.zip");
    const out = path.join(dir, `${name}.zip`);
    await writeFile(deck, body);
    await runShare(options, ["--config", options.configPath, "--deck", deck, "--out", out]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runShare(options: ShareRouteOptions, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [options.script, ...args], { cwd: options.cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(output.trim() || `scripts/share.mjs exited with ${code}.`));
    });
  });
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > MAX_DECK_BYTES) {
        reject(new Error(`The talk package is larger than ${MAX_DECK_BYTES / 1024 / 1024} MB.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function reply(res: ServerResponse, status: number, message: string): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}
