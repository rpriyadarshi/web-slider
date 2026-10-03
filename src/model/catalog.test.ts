import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import YAML from "js-yaml";
import { CATALOG_PATH, parseCatalog } from "./catalog";
import { loadInstall } from "./install";
import { parseDeck } from "./parse";

const root = fileURLToPath(new URL("../..", import.meta.url));
const origin = "http://slider.test/";

function readSite(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

function sampleFetch(): typeof fetch {
  return async (input) => {
    const url = new URL(String(input), origin);
    const relative = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const file = path.join(root, relative);
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      return new Response("", { status: 404 });
    }
    const body = readFileSync(file);
    const ext = path.extname(file).toLowerCase();
    const type =
      ext === ".svg" ? "image/svg+xml" : ext === ".ttf" ? "font/ttf" : ext === ".json" ? "application/json" : "text/yaml; charset=utf-8";
    return new Response(body, { status: 200, headers: { "content-type": type } });
  };
}

function yamlFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) found.push(...yamlFiles(file));
    else if (name.endsWith(".yaml") || name.endsWith(".yml")) found.push(file);
  }
  return found;
}

describe("sample catalog", () => {
  const catalog = parseCatalog(readSite(CATALOG_PATH));

  it("loads every install, including each product theme", async () => {
    const fetch = sampleFetch();
    const loaded = await Promise.all(
      catalog.installs.map((entry) => loadInstall({ fetch, origin }, { path: entry.path })),
    );
    const paths = loaded.map((install) => install.manifestPath);
    const themeDirs = readdirSync(path.join(root, "samples/themes")).filter((name) =>
      statSync(path.join(root, "samples/themes", name)).isDirectory(),
    );
    for (const name of themeDirs) {
      expect(paths).toContain(`samples/themes/${name}/manifest.yaml`);
    }
    expect(loaded.map((install) => install.manifest.brand)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ wordmark: "EMPORION" }),
        expect.objectContaining({ wordmark: "HARBOR" }),
        expect.objectContaining({ wordmark: "LEDGER" }),
        expect.objectContaining({ wordmark: "MERIDIAN" }),
      ]),
    );
    const northwind = loaded.find((install) => install.manifestPath === "samples/examples/northwind/manifest.yaml");
    expect(northwind?.manifest.brand).toMatchObject({ wordmark: "EMPORION" });
    expect(northwind?.manifest.theme.accent).toBe("#e2a354");
  });

  it("parses every example talk and lists every talk under samples/examples", () => {
    const listed = new Set(catalog.examples.map((entry) => entry.path));
    for (const entry of catalog.examples) {
      const deck = parseDeck(readSite(entry.path));
      expect(deck.title.length).toBeGreaterThan(0);
      expect(deck.slides.length).toBeGreaterThan(0);
    }
    for (const file of yamlFiles(path.join(root, "samples/examples"))) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      const loaded = YAML.load(readSite(relative));
      if (!loaded || typeof loaded !== "object" || Array.isArray(loaded) || !("slides" in loaded)) continue;
      expect(listed.has(relative)).toBe(true);
    }
  });
});
