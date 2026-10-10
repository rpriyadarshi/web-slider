import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blankDeckSource } from "./blank";
import { loadInstall, localFileUrl, manifestAssetRefs, parseConfig, parseManifest } from "./install";
import { parseDeck } from "./parse";
import { emptyChrome, sessionFromDeck } from "./session";

type Route = { status: number; body: string; type?: string };

const origin = "http://slider.test/";
const packageDir = "samples/themes/emporion";
const read = (relative: string) => readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");
const packageManifest = read(`${packageDir}/manifest.yaml`);

function serve(map: Record<string, Route>): typeof fetch {
  return async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const route = map[url];
    if (!route) return new Response("missing", { status: 404, headers: { "content-type": "text/plain" } });
    return new Response(route.body, { status: route.status, headers: { "content-type": route.type ?? "text/yaml" } });
  };
}

function themeAt(url: (path: string) => string, dir: string): Record<string, Route> {
  const refs = manifestAssetRefs(parseManifest(packageManifest));
  return {
    [url(`${dir}/manifest.yaml`)]: { status: 200, body: packageManifest },
    ...Object.fromEntries(
      refs.map((ref) => [
        url(`${dir}/${ref}`),
        ref.endsWith(".svg")
          ? { status: 200, body: read(`${packageDir}/${ref}`), type: "image/svg+xml" }
          : { status: 200, body: "ttf", type: "font/ttf" },
      ]),
    ),
  };
}

describe("default talk", () => {
  it("puts a site config's deck on the install as written", async () => {
    const fetchImpl = serve({
      [`${origin}talk/web-slider.config.yaml`]: { status: 200, body: "manifest: emporion\ndeck: talk/deck.zip\n" },
      ...themeAt((path) => `${origin}${path}`, packageDir),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { path: "talk/web-slider.config.yaml" });
    expect(install.deckPath).toBe("talk/deck.zip");
  });

  it("resolves a disk config's deck beside the config, as it does the manifest", async () => {
    const dir = "/home/author/theme";
    const fetchImpl = serve(themeAt((path) => localFileUrl(origin, path), dir));
    const install = await loadInstall(
      { fetch: fetchImpl, origin },
      { source: "manifest: manifest.yaml\ndeck: talks/pd-dv.zip\n", configPath: `${dir}/web-slider.config.yaml` },
    );
    expect(install.manifestPath).toBe(`${dir}/manifest.yaml`);
    expect(install.deckPath).toBe(`${dir}/talks/pd-dv.zip`);
  });

  it("leaves the install without a talk when the config names none", async () => {
    const fetchImpl = serve({
      [`${origin}talk/web-slider.config.yaml`]: { status: 200, body: "manifest: emporion\n" },
      ...themeAt((path) => `${origin}${path}`, packageDir),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { path: "talk/web-slider.config.yaml" });
    expect(install.deckPath).toBeUndefined();
  });

  it("refuses a deck that is not a site path to a .yaml, .yml, or .zip", () => {
    expect(parseConfig("manifest: emporion\ndeck: talk/deck.yml\n")).toEqual({ manifest: "emporion", deck: "talk/deck.yml" });
    for (const deck of ["../deck.zip", "/home/author/deck.zip", "talk/deck.pptx", "https://example.com/deck.zip", "talk\\deck.zip"]) {
      expect(() => parseConfig(`manifest: emporion\ndeck: "${deck.replace(/\\/g, "\\\\")}"\n`)).toThrow(/deck: must be a site path/);
    }
  });

  it("opens a fresh session with Outline and Examples docked and YAML closed", () => {
    const chrome = emptyChrome();
    expect({
      toc: chrome.toc,
      tocPinned: chrome.tocPinned,
      side: chrome.side,
      sidePinned: chrome.sidePinned,
      yaml: chrome.yaml,
    }).toEqual({ toc: true, tocPinned: true, side: true, sidePinned: true, yaml: false });
    const session = sessionFromDeck(parseDeck(blankDeckSource()));
    expect({ side: session.ui.side, yaml: session.ui.yaml, tocPinned: session.ui.tocPinned }).toEqual({
      side: true,
      yaml: false,
      tocPinned: true,
    });
  });
});
