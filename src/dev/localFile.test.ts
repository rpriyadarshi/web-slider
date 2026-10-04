import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { diskContentType, isAllowedDiskPath, openDiskFile } from "./localFile";

const roots: string[] = [];

function scratch(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "slider-local-"));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("local disk files", () => {
  it("serves a yaml config, a mark, and the theme cache, and refuses other files", () => {
    const dir = scratch();
    const manifest = path.join(dir, "manifest.yaml");
    const mark = path.join(dir, "mark.svg");
    const cache = path.join(dir, "manifest.resolved.json");
    const notes = path.join(dir, "notes.txt");
    writeFileSync(manifest, "manifest: manifest.yaml\n");
    writeFileSync(mark, "<svg></svg>");
    writeFileSync(cache, "{}");
    writeFileSync(notes, "secret");

    expect(openDiskFile("config", manifest)).toEqual({ ok: true, path: realpathSync(manifest) });
    const openedMark = openDiskFile("file", mark);
    expect(openedMark).toEqual({ ok: true, path: realpathSync(mark) });
    if (openedMark.ok) expect(diskContentType(openedMark.path)).toBe("image/svg+xml");
    const openedCache = openDiskFile("file", cache);
    expect(openedCache.ok).toBe(true);
    if (openedCache.ok) expect(diskContentType(openedCache.path)).toBe("application/json");

    expect(openDiskFile("file", notes).ok).toBe(false);
    expect(openDiskFile("file", path.join(dir, "other.json")).ok).toBe(false);
    expect(openDiskFile("config", mark).ok).toBe(false);
    expect(isAllowedDiskPath("file", "/tmp/../etc/passwd")).toBe(false);
    expect(openDiskFile("file", `${dir}/../${path.basename(dir)}/manifest.yaml`).ok).toBe(false);

    const folder = path.join(dir, "folder.yaml");
    mkdirSync(folder);
    expect(openDiskFile("config", folder)).toMatchObject({ ok: false, status: 404 });
    expect(openDiskFile("config", path.join(dir, "missing.yaml"))).toMatchObject({ ok: false, status: 404 });
  });

  it("follows a symlink only when the canonical file is itself allowed", () => {
    const dir = scratch();
    const manifest = path.join(dir, "manifest.yaml");
    const secret = path.join(dir, "secret.txt");
    const alias = path.join(dir, "alias.yaml");
    const stolen = path.join(dir, "stolen.yaml");
    writeFileSync(manifest, "ok\n");
    writeFileSync(secret, "secret");
    symlinkSync(manifest, alias);
    symlinkSync(secret, stolen);

    expect(openDiskFile("config", alias)).toEqual({ ok: true, path: realpathSync(manifest) });
    expect(openDiskFile("config", stolen)).toMatchObject({ ok: false, status: 400 });
    expect(openDiskFile("file", stolen)).toMatchObject({ ok: false, status: 400 });
  });
});
