import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import YAML from "js-yaml";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseConfig } from "../src/model/install";
import { checkIndex, readShareArgs, readTalk, readTheme, STAGED_CONFIG, stageTalk, zipFolder } from "./share.mjs";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "web-slider-share-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function themeConfig() {
  const root = path.join(dir, "theme");
  await mkdir(path.join(root, "fonts"), { recursive: true });
  await writeFile(path.join(root, "web-slider.config.yaml"), "manifest: manifest.yaml\n");
  await writeFile(
    path.join(root, "manifest.yaml"),
    ["brand:", "  name: Test", "  mark: mark.svg", "fonts:", "  Inter:", "    regular: fonts/Inter-Regular.ttf", ""].join("\n"),
  );
  await writeFile(path.join(root, "mark.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  await writeFile(path.join(root, "fonts", "Inter-Regular.ttf"), "font");
  await writeFile(path.join(root, "fonts", "Inter-LICENSE.txt"), "OFL");
  await writeFile(path.join(root, "fonts", "Unused-Regular.ttf"), "font");
  return path.join(root, "web-slider.config.yaml");
}

async function talkZip(carryImage) {
  const zip = new JSZip();
  zip.file(
    "deck.yaml",
    YAML.dump({ id: "t", title: "T", slides: [{ id: "a", title: "A", blocks: [{ type: "image", src: "diagrams/a.png" }] }] }),
  );
  if (carryImage) zip.file("diagrams/a.png", new Uint8Array([1, 2, 3]));
  const file = path.join(dir, "talk.zip");
  await writeFile(file, await zip.generateAsync({ type: "nodebuffer" }));
  return file;
}

describe("runnable package", () => {
  it("stages a config the presenter accepts that names the theme and the shipped talk, with marks, fonts, and the font licence", async () => {
    const app = path.join(dir, "app");
    await stageTalk({ theme: await readTheme(await themeConfig()), talk: await readTalk(await talkZip(true)), appDir: app });
    expect(parseConfig(await readFile(path.join(app, STAGED_CONFIG), "utf8"))).toEqual({
      manifest: "talk/manifest.yaml",
      deck: "talk/deck.zip",
    });
    for (const file of ["talk/manifest.yaml", "talk/mark.svg", "talk/fonts/Inter-Regular.ttf", "talk/fonts/Inter-LICENSE.txt", "talk/deck.zip"]) {
      expect((await readFile(path.join(app, file))).byteLength).toBeGreaterThan(0);
    }
    await expect(readFile(path.join(app, "talk/fonts/Unused-Regular.ttf"))).rejects.toThrow();
  });

  it("requires the built index to carry the staged config path", () => {
    expect(() => checkIndex(`<html data-slider-config="${STAGED_CONFIG}" lang="en">`)).not.toThrow();
    expect(() => checkIndex(`<html lang="en">`)).toThrow(/data-slider-config/);
  });

  it("refuses a talk that names files it does not carry, a brand package name, and relative paths", async () => {
    await expect(readTalk(await talkZip(false))).rejects.toThrow(/diagrams\/a\.png/);
    const config = await themeConfig();
    await writeFile(path.join(path.dirname(config), "manifest.yaml"), "brand: emporion\n");
    await expect(readTheme(config)).rejects.toThrow(/brand package name/);
    expect(() => readShareArgs(["--config", "theme/web-slider.config.yaml", "--deck", "/a/t.zip", "--out", "/a/o.zip"])).toThrow(/absolute/);
    expect(readShareArgs(["--config", "/a/c.yaml", "--deck", "/a/t.zip", "--out", "/a/pd-dv-presenter.zip"]).name).toBe("pd-dv-presenter");
  });

  it("zips one folder with the launchers and runtimes executable", async () => {
    const root = path.join(dir, "pkg");
    await mkdir(path.join(root, "runtime"), { recursive: true });
    await writeFile(path.join(root, "Start.command"), "#!/bin/bash\n");
    await writeFile(path.join(root, "README.txt"), "Read me.\n");
    await writeFile(path.join(root, "runtime", "server-linux-amd64"), "binary");
    const zip = await JSZip.loadAsync(await zipFolder(root, "pkg"));
    expect(zip.file("pkg/Start.command")?.unixPermissions & 0o777).toBe(0o755);
    expect(zip.file("pkg/runtime/server-linux-amd64")?.unixPermissions & 0o777).toBe(0o755);
    expect(zip.file("pkg/README.txt")?.unixPermissions & 0o777).toBe(0o644);
  });
});
