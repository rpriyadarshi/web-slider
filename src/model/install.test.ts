import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "./parse";
import { resolveTheme } from "./schema";
import { serializeDeck } from "./serialize";
import { sessionFromDeck } from "./session";
import {
  canonicalJson,
  loadInstall,
  parseManifest,
  presentTalk,
  resolveManifest,
  sourceHash,
} from "./install";

const origin = "http://slider.test/";
const configUrl = `${origin}web-slider.config.yaml`;
const northwindUrl = `${origin}themes/northwind/manifest.yaml`;
const cacheUrl = `${origin}themes/northwind/manifest.resolved.json`;
const packageDir = "themes/emporion";
const packageManifestPath = `${packageDir}/manifest.yaml`;
const shippedConfig = readFileSync(new URL("../../public/web-slider.config.yaml", import.meta.url), "utf8");
const shippedManifest = readFileSync(new URL("../../public/themes/northwind/manifest.yaml", import.meta.url), "utf8");
const packageManifest = readFileSync(new URL(`../../public/${packageManifestPath}`, import.meta.url), "utf8");
const markLight = readFileSync(new URL(`../../public/${packageDir}/mark.svg`, import.meta.url), "utf8");
const markDark = readFileSync(new URL(`../../public/${packageDir}/mark-on-dark.svg`, import.meta.url), "utf8");
readFileSync(new URL(`../../public/${packageDir}/fonts/Inter-Regular.ttf`, import.meta.url));
const sample = readFileSync(new URL("../../public/examples/launch-review.yaml", import.meta.url), "utf8");

const resolvedBrand = {
  name: "Emporion",
  wordmark: "EMPORION",
  tail: "AI",
  accent: "#3DB892",
  highlight: "#E4B84A",
  mark: `${packageDir}/mark.svg`,
  markDark: `${packageDir}/mark-on-dark.svg`,
};

function packageAssets(): Record<string, { status: number; body: string; type?: string }> {
  const fonts = [
    "fonts/Inter-Regular.ttf",
    "fonts/Inter-SemiBold.ttf",
    "fonts/SourceSerif4-Regular.ttf",
    "fonts/SourceSerif4-Semibold.ttf",
    "fonts/JetBrainsMono-Regular.ttf",
    "fonts/JetBrainsMono-Bold.ttf",
  ];
  return {
    [`${origin}${packageManifestPath}`]: { status: 200, body: packageManifest },
    [`${origin}${packageDir}/mark.svg`]: { status: 200, type: "image/svg+xml", body: markLight },
    [`${origin}${packageDir}/mark-on-dark.svg`]: { status: 200, type: "image/svg+xml", body: markDark },
    ...Object.fromEntries(fonts.map((name) => [`${origin}${packageDir}/${name}`, { status: 200, type: "font/ttf", body: "ttf" }])),
  };
}

function routes(map: Record<string, { status: number; body: string; type?: string }>) {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const route = map[url];
    if (!route) return new Response("missing", { status: 404, headers: { "content-type": "text/plain" } });
    return new Response(route.body, {
      status: route.status,
      headers: { "content-type": route.type ?? "text/yaml" },
    });
  };
  return { fetchImpl, calls };
}

describe("theme package", () => {
  it("loads the shipped config and manifest, and the sample talk does not copy them", async () => {
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin });
    expect(install.manifestPath).toBe("themes/northwind/manifest.yaml");
    expect(calls).toContain(cacheUrl);
    expect(calls).toContain(`${origin}${packageManifestPath}`);
    expect(calls).toContain(`${origin}${packageDir}/mark.svg`);
    expect(calls).toContain(`${origin}${packageDir}/mark-on-dark.svg`);
    expect(calls).toContain(`${origin}${packageDir}/fonts/Inter-Regular.ttf`);
    expect(install.assetUrls.get(`${packageDir}/mark.svg`)).toBe(`${origin}${packageDir}/mark.svg`);
    expect(install.assetUrls.get(`${packageDir}/mark-on-dark.svg`)).toBe(`${origin}${packageDir}/mark-on-dark.svg`);
    expect(markLight).toContain('fill="#3DB892"');
    expect(markDark).toContain('fill="#E4B84A"');
    expect(install.manifest.brand).toEqual(resolvedBrand);
    expect(install.manifest.fonts?.Inter?.regular).toBe(`${packageDir}/fonts/Inter-Regular.ttf`);
    expect(install.manifest.theme.background).toBe("#14181f");
    expect(install.manifest.theme.type?.mark).toBe(22);
    expect(install.manifest.theme.chromeDark?.ground).toBe("#121212");

    const talk = parseDeck(sample);
    const presented = presentTalk(talk, install.manifest);
    expect(presented.brand).toEqual(resolvedBrand);
    expect(presented.aspect).toBe("16:9");
    expect(resolveTheme(presented.theme).type.wordmark).toBe(12);
    expect(resolveTheme(presented.theme, talk.slides.find((slide) => slide.id === "date")?.theme).background).toBe("#1b2430");
    const exported = serializeDeck(presented, sessionFromDeck(talk));
    expect(exported).not.toContain("brand:");
    expect(exported).not.toContain("fontHeading:");
    expect(parseDeck(exported).slides.find((slide) => slide.id === "date")?.theme?.accent).toBe("#8eb6ff");
  });

  it("loads the default package when the config file is missing", async () => {
    const { fetchImpl, calls } = routes({
      ...packageAssets(),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin });
    expect(install.manifestPath).toBe(packageManifestPath);
    expect(install.manifest.brand).toEqual(resolvedBrand);
    expect(install.manifest.theme.highlight).toBe("#E4B84A");
    expect(install.assetUrls.get(`${packageDir}/mark.svg`)).toBe(`${origin}${packageDir}/mark.svg`);
    expect(calls).toContain(configUrl);
    expect(calls).toContain(`${origin}${packageManifestPath}`);
    expect(calls).toContain(`${origin}${packageDir}/mark-on-dark.svg`);
  });

  it("resolves a package name in manifest to themes/<name>/manifest.yaml", async () => {
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: "manifest: emporion\n" },
      ...packageAssets(),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin });
    expect(install.manifestPath).toBe(packageManifestPath);
    expect(install.manifest.brand).toEqual(resolvedBrand);
    expect(calls).toContain(`${origin}${packageManifestPath}`);
    expect(calls).toContain(`${origin}${packageDir}/mark.svg`);
    expect(calls).toContain(`${origin}${packageDir}/fonts/JetBrainsMono-Bold.ttf`);
  });

  it("resolves a different package name through the same rule", async () => {
    const harborManifest = `
brand:
  name: Harbor
  wordmark: HARBOR
  tail: CO
  accent: "#336699"
  highlight: "#CCAA44"
  mark: mark.svg
`;
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: "manifest: harbor\n" },
      [`${origin}themes/harbor/manifest.yaml`]: { status: 200, body: harborManifest },
      [`${origin}themes/harbor/mark.svg`]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
    });
    const install = await loadInstall({ fetch: fetchImpl, origin });
    expect(install.manifestPath).toBe("themes/harbor/manifest.yaml");
    expect(install.manifest.brand).toMatchObject({ wordmark: "HARBOR", mark: "themes/harbor/mark.svg" });
    expect(calls).toContain(`${origin}themes/harbor/manifest.yaml`);
    expect(calls).toContain(`${origin}themes/harbor/mark.svg`);
    expect(install.assetUrls.get("themes/harbor/mark.svg")).toBe(`${origin}themes/harbor/mark.svg`);
  });

  it("resolves brand as a package name on another manifest", async () => {
    const harborManifest = `
brand:
  name: Harbor
  wordmark: HARBOR
  accent: "#336699"
  highlight: "#CCAA44"
  mark: mark.svg
  markDark: mark-dark.svg
`;
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: "manifest: themes/custom/manifest.yaml\n" },
      [`${origin}themes/custom/manifest.yaml`]: { status: 200, body: "brand: harbor\ntheme:\n  highlight: \"#CCAA44\"\n" },
      [`${origin}themes/harbor/manifest.yaml`]: { status: 200, body: harborManifest },
      [`${origin}themes/harbor/mark.svg`]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
      [`${origin}themes/harbor/mark-dark.svg`]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
    });
    const install = await loadInstall({ fetch: fetchImpl, origin });
    expect(install.manifestPath).toBe("themes/custom/manifest.yaml");
    expect(install.manifest.brand).toMatchObject({
      wordmark: "HARBOR",
      mark: "themes/harbor/mark.svg",
      markDark: "themes/harbor/mark-dark.svg",
    });
    expect(calls).toContain(`${origin}themes/harbor/manifest.yaml`);
    expect(calls).not.toContain(`${origin}themes/custom/mark.svg`);
  });

  it("fails when a brand package cycles or is missing", async () => {
    const cycle = routes({
      [configUrl]: { status: 200, body: "manifest: alpha\n" },
      [`${origin}themes/alpha/manifest.yaml`]: { status: 200, body: "brand: beta\n" },
      [`${origin}themes/beta/manifest.yaml`]: { status: 200, body: "brand: alpha\n" },
    });
    await expect(loadInstall({ fetch: cycle.fetchImpl, origin })).rejects.toThrow(/Brand package cycle/);
    await expect(loadInstall({ fetch: cycle.fetchImpl, origin })).rejects.toThrow(/not replaced with another brand/);

    const missingBrand = routes({
      [configUrl]: { status: 200, body: "manifest: themes/custom/manifest.yaml\n" },
      [`${origin}themes/custom/manifest.yaml`]: { status: 200, body: "brand: harbor\n" },
    });
    await expect(loadInstall({ fetch: missingBrand.fetchImpl, origin })).rejects.toThrow(
      /Theme package not found: themes\/harbor\/manifest\.yaml/,
    );
  });

  it("fails when the package or its mark is missing", async () => {
    const missingPackage = routes({
      [configUrl]: { status: 200, body: "manifest: emporion\n" },
    });
    await expect(loadInstall({ fetch: missingPackage.fetchImpl, origin })).rejects.toThrow(
      /Theme package not found: themes\/emporion\/manifest\.yaml/,
    );
    await expect(loadInstall({ fetch: missingPackage.fetchImpl, origin })).rejects.toThrow(/not replaced with another brand/);

    const missingMark = routes({
      [configUrl]: { status: 200, body: "manifest: emporion\n" },
      [`${origin}${packageManifestPath}`]: { status: 200, body: packageManifest },
    });
    await expect(loadInstall({ fetch: missingMark.fetchImpl, origin })).rejects.toThrow(
      /Theme asset failed to load \(404\): themes\/emporion\/mark\.svg/,
    );

    const htmlMark = routes({
      [configUrl]: { status: 200, body: "manifest: emporion\n" },
      [`${origin}${packageManifestPath}`]: { status: 200, body: packageManifest },
      [`${origin}${packageDir}/mark.svg`]: { status: 200, type: "text/html", body: "<!doctype html><html></html>" },
    });
    await expect(loadInstall({ fetch: htmlMark.fetchImpl, origin })).rejects.toThrow(
      /Theme asset not found: themes\/emporion\/mark\.svg/,
    );
  });

  it("fails when a missing manifest comes back as the app shell", async () => {
    const { fetchImpl } = routes({
      [configUrl]: { status: 200, body: "manifest: themes/missing/manifest.yaml\n" },
      [`${origin}themes/missing/manifest.yaml`]: {
        status: 200,
        type: "text/html",
        body: "<!doctype html><html></html>",
      },
    });
    await expect(loadInstall({ fetch: fetchImpl, origin })).rejects.toThrow(/Manifest not found: themes\/missing\/manifest.yaml/);
    await expect(loadInstall({ fetch: fetchImpl, origin })).rejects.toThrow(/not replaced with another package/);
  });

  it("fails when the config points at a missing manifest", async () => {
    const { fetchImpl } = routes({
      [configUrl]: { status: 200, body: "manifest: themes/missing/manifest.yaml\n" },
    });
    await expect(loadInstall({ fetch: fetchImpl, origin })).rejects.toThrow(/Manifest not found: themes\/missing\/manifest.yaml/);
    await expect(loadInstall({ fetch: fetchImpl, origin })).rejects.toThrow(/not replaced with another package/);
  });

  it("fails on a bad config, a bad manifest, and a missing theme asset", async () => {
    const badConfig = routes({
      [configUrl]: { status: 200, body: "manifest: ../secret.yaml\n" },
    });
    await expect(loadInstall({ fetch: badConfig.fetchImpl, origin })).rejects.toThrow(/failed validation|must be/);

    const badManifest = routes({
      [configUrl]: { status: 200, body: "manifest: themes/northwind/manifest.yaml\n" },
      [northwindUrl]: { status: 200, body: "brand: other\ntheme:\n  animation: spin\n" },
    });
    await expect(loadInstall({ fetch: badManifest.fetchImpl, origin })).rejects.toThrow(/Manifest failed validation/);

    const missingAsset = routes({
      [configUrl]: { status: 200, body: "manifest: themes/northwind/manifest.yaml\n" },
      [northwindUrl]: {
        status: 200,
        body: `
brand:
  name: Northwind
  wordmark: NORTHWIND
  accent: "#3DB892"
  highlight: "#E4B84A"
  mark: brand/mark.svg
`,
      },
    });
    await expect(loadInstall({ fetch: missingAsset.fetchImpl, origin })).rejects.toThrow(
      /Theme asset failed to load \(404\): themes\/northwind\/brand\/mark.svg/,
    );
  });

  it("ignores a stale theme cache and rejects a cache that disagrees with the manifest", async () => {
    const hash = await sourceHash(shippedManifest);
    const resolved = resolveManifest(parseManifest(shippedManifest), hash);
    const stale = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
      [cacheUrl]: {
        status: 200,
        type: "application/json",
        body: canonicalJson({ ...resolved, sourceHash: "a".repeat(64) }),
      },
    });
    const install = await loadInstall({ fetch: stale.fetchImpl, origin });
    expect(install.manifest.theme.background).toBe("#14181f");

    const divergent = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
      [cacheUrl]: {
        status: 200,
        type: "application/json",
        body: canonicalJson({
          ...resolved,
          theme: { ...resolved.theme, background: "#000000" },
        }),
      },
    });
    await expect(loadInstall({ fetch: divergent.fetchImpl, origin })).rejects.toThrow(/does not match the manifest/);

    const invalid = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
      [cacheUrl]: { status: 200, type: "application/json", body: "{" },
    });
    await expect(loadInstall({ fetch: invalid.fetchImpl, origin })).rejects.toThrow(/Theme cache is invalid/);
  });
});
