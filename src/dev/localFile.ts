import { realpathSync, statSync } from "node:fs";
import path from "node:path";

export type DiskKind = "config" | "file";

export type OpenedDiskFile =
  | { ok: true; path: string }
  | { ok: false; status: 400 | 404; message: string };

export function diskKind(pathname: string): DiskKind | null {
  if (pathname === "/__slider/local-config") return "config";
  if (pathname === "/__slider/local-file") return "file";
  return null;
}

/** Suffix rules for a path the dev server may read. Applied to the request and to the canonical file. */
export function isAllowedDiskPath(kind: DiskKind, filePath: string): boolean {
  if (!filePath.startsWith("/") || filePath.includes("\\") || filePath.split("/").includes("..")) return false;
  if (kind === "config") return /\.ya?ml$/.test(filePath);
  const base = filePath.slice(filePath.lastIndexOf("/") + 1);
  if (base === "manifest.resolved.json") return true;
  return /\.(ya?ml|svg|ttf|otf|woff2?|zip)$/i.test(filePath);
}

export function openDiskFile(kind: DiskKind, filePath: string): OpenedDiskFile {
  if (!isAllowedDiskPath(kind, filePath)) {
    return { ok: false, status: 400, message: refused(kind) };
  }
  const lexical = path.resolve(filePath);
  let canonical: string;
  try {
    canonical = realpathSync(lexical);
  } catch {
    return { ok: false, status: 404, message: missing(kind, lexical) };
  }
  let file = false;
  try {
    file = statSync(canonical).isFile();
  } catch {
    return { ok: false, status: 404, message: missing(kind, lexical) };
  }
  if (!file) return { ok: false, status: 404, message: missing(kind, lexical) };
  if (!isAllowedDiskPath(kind, canonical)) {
    return { ok: false, status: 400, message: refused(kind) };
  }
  return { ok: true, path: canonical };
}

export function diskContentType(filePath: string): string {
  const types: Record<string, string> = {
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".json": "application/json",
    ".zip": "application/zip",
  };
  return types[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function refused(kind: DiskKind): string {
  return kind === "config"
    ? "Config path must be a .yaml file on disk."
    : "File path must be a manifest, mark, font, talk, or theme cache on disk.";
}

function missing(kind: DiskKind, filePath: string): string {
  return kind === "config" ? `Config not found: ${filePath}` : `File not found: ${filePath}`;
}
