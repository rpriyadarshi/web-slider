import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDeck } from "./parse";
import { resolveTheme } from "./schema";
import { serializeDeck } from "./serialize";
import { sessionFromDeck } from "./session";
import {
  canonicalJson,
  diskManifestPath,
  diskResolvedCachePath,
  injectedConfigPath,
  isDiskConfigPath,
  loadInstall,
  localFileUrl,
  parseManifest,
  presentTalk,
  resolveBootConfig,
  resolveManifest,
  sourceHash,
} from "./install";

const origin = "http://slider.test/";
const configPath = "samples/examples/northwind/web-slider.config.yaml";
const configUrl = `${origin}${configPath}`;
const northwindPath = "samples/examples/northwind/manifest.yaml";
const northwindUrl = `${origin}${northwindPath}`;
const cacheUrl = `${origin}samples/examples/northwind/manifest.resolved.json`;
const packageDir = "samples/themes/emporion";
const packageManifestPath = `${packageDir}/manifest.yaml`;
const shippedConfig = readFileSync(new URL(`../../${configPath}`, import.meta.url), "utf8");
const shippedManifest = readFileSync(new URL(`../../${northwindPath}`, import.meta.url), "utf8");
const packageManifest = readFileSync(new URL(`../../${packageManifestPath}`, import.meta.url), "utf8");
const markLight = readFileSync(new URL(`../../${packageDir}/mark.svg`, import.meta.url), "utf8");
const markDark = readFileSync(new URL(`../../${packageDir}/mark-on-dark.svg`, import.meta.url), "utf8");
readFileSync(new URL(`../../${packageDir}/fonts/Inter-Regular.ttf`, import.meta.url));
const sample = readFileSync(new URL("../../samples/examples/launch-review.yaml", import.meta.url), "utf8");

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
  it("asks for a config when none is injected and the query is empty", async () => {
    expect(resolveBootConfig({ cli: injectedConfigPath(undefined, null), query: null })).toEqual({
      status: "config-required",
    });
    expect(resolveBootConfig({ cli: injectedConfigPath("", "  "), query: "" })).toEqual({ status: "config-required" });
    expect(resolveBootConfig({ cli: "  ", query: null })).toEqual({ status: "config-required" });
    expect(isDiskConfigPath("/var/talks/acme/web-slider.config.yaml")).toBe(true);
    expect(isDiskConfigPath("samples/examples/emporion/web-slider.config.yaml")).toBe(false);
    expect(isDiskConfigPath("/tmp/../etc/passwd")).toBe(false);
    const { fetchImpl, calls } = routes(packageAssets());
    await expect(loadInstall({ fetch: fetchImpl, origin }, { path: "   " })).rejects.toThrow(/Config required/);
    expect(calls).toEqual([]);
  });

  it("loads northwind from the injected config path and lets that path outrank the query", async () => {
    const boot = resolveBootConfig({
      cli: injectedConfigPath(configPath, "samples/examples/other/web-slider.config.yaml"),
      query: "samples/examples/other/web-slider.config.yaml",
    });
    expect(boot).toEqual({ status: "path", path: configPath });
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { path: boot.status === "path" ? boot.path : "" });
    expect(install.manifestPath).toBe(northwindPath);
    expect(install.manifest.brand).toEqual(resolvedBrand);
    expect(install.manifest.theme.background).toBe("#14181f");
    expect(calls).toContain(`${origin}${packageManifestPath}`);
    expect(calls).toContain(`${origin}${packageDir}/mark-on-dark.svg`);
    expect(calls).not.toContain(`${origin}web-slider.config.yaml`);
    expect(calls.some((url) => url.includes("samples/examples/other/"))).toBe(false);
  });

  it("loads northwind from the config query when no command-line path is set", async () => {
    expect(injectedConfigPath(undefined, configPath)).toBe(configPath);
    const boot = resolveBootConfig({
      cli: injectedConfigPath("", null),
      query: configPath,
    });
    expect(boot).toEqual({ status: "path", path: configPath });
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { path: boot.status === "path" ? boot.path : "" });
    expect(install.manifestPath).toBe(northwindPath);
    expect(install.manifest.brand).toEqual(resolvedBrand);
    expect(calls).toContain(configUrl);
    expect(calls).toContain(`${origin}${packageManifestPath}`);
    expect(calls).not.toContain(`${origin}web-slider.config.yaml`);
  });

  it("loads the sample admin config, resolves brand: emporion through samples/themes/emporion/, and the sample talk does not copy them", async () => {
    expect(shippedConfig).toContain("manifest: samples/examples/northwind/manifest.yaml");
    expect(shippedManifest).toContain("brand: emporion");
    const { fetchImpl, calls } = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { path: configPath });
    expect(install.manifestPath).toBe(northwindPath);
    expect(calls).toContain(cacheUrl);
    expect(calls).not.toContain(`${origin}web-slider.config.yaml`);
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

  it("fails when the config file is missing and does not load a package", async () => {
    const missing = routes(packageAssets());
    await expect(loadInstall({ fetch: missing.fetchImpl, origin }, { path: configPath })).rejects.toThrow(
      /Config not found: samples\/examples\/northwind\/web-slider.config.yaml/,
    );
    await expect(loadInstall({ fetch: missing.fetchImpl, origin }, { path: configPath })).rejects.toThrow(
      /not replaced with a theme package/,
    );
    expect(missing.calls).not.toContain(`${origin}${packageManifestPath}`);

    const html = routes({
      [configUrl]: { status: 200, type: "text/html", body: "<!doctype html><html></html>" },
      ...packageAssets(),
    });
    await expect(loadInstall({ fetch: html.fetchImpl, origin }, { path: configPath })).rejects.toThrow(
      /Config not found: samples\/examples\/northwind\/web-slider.config.yaml/,
    );
    expect(html.calls).not.toContain(`${origin}${packageManifestPath}`);
  });

  it("resolves a package name in manifest to samples/themes/<name>/manifest.yaml", async () => {
    const { fetchImpl, calls } = routes(packageAssets());
    const install = await loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: emporion\n" });
    expect(install.manifestPath).toBe(packageManifestPath);
    expect(install.manifest.brand).toEqual(resolvedBrand);
    expect(install.manifest.theme.background).toBe("#FAFAFA");
    expect(install.manifest.theme.accent).toBe("#3DB892");
    expect(install.manifest.theme.chrome).toBe("light");
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
      [`${origin}samples/themes/harbor/manifest.yaml`]: { status: 200, body: harborManifest },
      [`${origin}samples/themes/harbor/mark.svg`]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: harbor\n" });
    expect(install.manifestPath).toBe("samples/themes/harbor/manifest.yaml");
    expect(install.manifest.brand).toMatchObject({ wordmark: "HARBOR", mark: "samples/themes/harbor/mark.svg" });
    expect(calls).toContain(`${origin}samples/themes/harbor/manifest.yaml`);
    expect(calls).toContain(`${origin}samples/themes/harbor/mark.svg`);
    expect(install.assetUrls.get("samples/themes/harbor/mark.svg")).toBe(`${origin}samples/themes/harbor/mark.svg`);
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
      [`${origin}samples/themes/custom/manifest.yaml`]: { status: 200, body: "brand: harbor\ntheme:\n  highlight: \"#CCAA44\"\n" },
      [`${origin}samples/themes/harbor/manifest.yaml`]: { status: 200, body: harborManifest },
      [`${origin}samples/themes/harbor/mark.svg`]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
      [`${origin}samples/themes/harbor/mark-dark.svg`]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
    });
    const install = await loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: samples/themes/custom/manifest.yaml\n" });
    expect(install.manifestPath).toBe("samples/themes/custom/manifest.yaml");
    expect(install.manifest.brand).toMatchObject({
      wordmark: "HARBOR",
      mark: "samples/themes/harbor/mark.svg",
      markDark: "samples/themes/harbor/mark-dark.svg",
    });
    expect(calls).toContain(`${origin}samples/themes/harbor/manifest.yaml`);
    expect(calls).not.toContain(`${origin}samples/themes/custom/mark.svg`);
  });

  it("fails when a brand package cycles or is missing", async () => {
    const cycle = routes({
      [`${origin}samples/themes/alpha/manifest.yaml`]: { status: 200, body: "brand: beta\n" },
      [`${origin}samples/themes/beta/manifest.yaml`]: { status: 200, body: "brand: alpha\n" },
    });
    await expect(loadInstall({ fetch: cycle.fetchImpl, origin }, { source: "manifest: alpha\n" })).rejects.toThrow(
      /Brand package cycle/,
    );
    await expect(loadInstall({ fetch: cycle.fetchImpl, origin }, { source: "manifest: alpha\n" })).rejects.toThrow(
      /not replaced with another brand/,
    );

    const missingBrand = routes({
      [`${origin}samples/themes/custom/manifest.yaml`]: { status: 200, body: "brand: harbor\n" },
    });
    await expect(
      loadInstall({ fetch: missingBrand.fetchImpl, origin }, { source: "manifest: samples/themes/custom/manifest.yaml\n" }),
    ).rejects.toThrow(/Theme package not found: samples\/themes\/harbor\/manifest\.yaml/);
  });

  it("fails when the package or its mark is missing", async () => {
    const missingPackage = routes({});
    await expect(loadInstall({ fetch: missingPackage.fetchImpl, origin }, { source: "manifest: emporion\n" })).rejects.toThrow(
      /Theme package not found: samples\/themes\/emporion\/manifest\.yaml/,
    );
    await expect(loadInstall({ fetch: missingPackage.fetchImpl, origin }, { source: "manifest: emporion\n" })).rejects.toThrow(
      /not replaced with another brand/,
    );

    const missingMark = routes({
      [`${origin}${packageManifestPath}`]: { status: 200, body: packageManifest },
    });
    await expect(loadInstall({ fetch: missingMark.fetchImpl, origin }, { source: "manifest: emporion\n" })).rejects.toThrow(
      /Theme asset failed to load \(404\): samples\/themes\/emporion\/mark\.svg/,
    );

    const htmlMark = routes({
      [`${origin}${packageManifestPath}`]: { status: 200, body: packageManifest },
      [`${origin}${packageDir}/mark.svg`]: { status: 200, type: "text/html", body: "<!doctype html><html></html>" },
    });
    await expect(loadInstall({ fetch: htmlMark.fetchImpl, origin }, { source: "manifest: emporion\n" })).rejects.toThrow(
      /Theme asset not found: samples\/themes\/emporion\/mark\.svg/,
    );
  });

  it("fails when a missing manifest comes back as the app shell", async () => {
    const { fetchImpl, calls } = routes({
      ...packageAssets(),
      [`${origin}samples/themes/missing/manifest.yaml`]: {
        status: 200,
        type: "text/html",
        body: "<!doctype html><html></html>",
      },
    });
    await expect(
      loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: samples/themes/missing/manifest.yaml\n" }),
    ).rejects.toThrow(/Manifest not found: samples\/themes\/missing\/manifest.yaml/);
    await expect(
      loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: samples/themes/missing/manifest.yaml\n" }),
    ).rejects.toThrow(/not replaced with another package/);
    expect(calls).not.toContain(`${origin}${packageManifestPath}`);
  });

  it("fails when the config points at a missing manifest and does not substitute emporion", async () => {
    const { fetchImpl, calls } = routes(packageAssets());
    await expect(
      loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: samples/themes/missing/manifest.yaml\n" }),
    ).rejects.toThrow(/Manifest not found: samples\/themes\/missing\/manifest.yaml/);
    await expect(
      loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: samples/themes/missing/manifest.yaml\n" }),
    ).rejects.toThrow(/not replaced with another package/);
    expect(calls).not.toContain(`${origin}${packageManifestPath}`);
  });

  it("fails on a bad config, a bad manifest, and a missing theme asset", async () => {
    const outside = routes(packageAssets());
    await expect(loadInstall({ fetch: outside.fetchImpl, origin }, { path: "../secret.yaml" })).rejects.toThrow(
      /failed validation|filesystem path/,
    );
    await expect(loadInstall({ fetch: outside.fetchImpl, origin }, { path: "/etc/web-slider.config.yaml" })).rejects.toThrow(
      /failed validation|filesystem path/,
    );
    await expect(loadInstall({ fetch: outside.fetchImpl, origin }, { source: "manifest: ../secret.yaml\n" })).rejects.toThrow(
      /failed validation|must be/,
    );
    expect(outside.calls).toEqual([]);

    const badManifest = routes({
      [northwindUrl]: { status: 200, body: "brand: other\ntheme:\n  animation: spin\n" },
    });
    await expect(
      loadInstall({ fetch: badManifest.fetchImpl, origin }, { source: "manifest: samples/examples/northwind/manifest.yaml\n" }),
    ).rejects.toThrow(/Manifest failed validation/);

    const missingAsset = routes({
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
    await expect(
      loadInstall({ fetch: missingAsset.fetchImpl, origin }, { source: "manifest: samples/examples/northwind/manifest.yaml\n" }),
    ).rejects.toThrow(/Theme asset failed to load \(404\): samples\/examples\/northwind\/brand\/mark.svg/);
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
    const install = await loadInstall({ fetch: stale.fetchImpl, origin }, { path: configPath });
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
    await expect(loadInstall({ fetch: divergent.fetchImpl, origin }, { path: configPath })).rejects.toThrow(
      /does not match the manifest/,
    );

    const invalid = routes({
      [configUrl]: { status: 200, body: shippedConfig },
      [northwindUrl]: { status: 200, body: shippedManifest },
      ...packageAssets(),
      [cacheUrl]: { status: 200, type: "application/json", body: "{" },
    });
    await expect(loadInstall({ fetch: invalid.fetchImpl, origin }, { path: configPath })).rejects.toThrow(
      /Theme cache is invalid/,
    );
  });

  it("loads the manifest beside a config file on disk and does not use a shipped theme", async () => {
    const file = "/var/talks/acme/web-slider.config.yaml";
    const manifestPath = "/var/talks/acme/manifest.yaml";
    const markPath = "/var/talks/acme/mark.svg";
    const cachePath = "/var/talks/acme/manifest.resolved.json";
    expect(diskManifestPath(file, "manifest.yaml")).toBe(manifestPath);
    expect(diskManifestPath(file, "emporion")).toBeNull();
    expect(diskManifestPath(file, "../secret.yaml")).toBeNull();
    expect(diskManifestPath(file, "/etc/manifest.yaml")).toBeNull();
    expect(diskManifestPath(file, "samples/themes/emporion/manifest.yaml")).toBeNull();
    expect(diskResolvedCachePath(manifestPath)).toBe(cachePath);
    expect(diskResolvedCachePath(packageManifestPath)).toBeNull();
    const { fetchImpl, calls } = routes(acmeRoutes(acmeManifest));
    const install = await loadInstall({ fetch: fetchImpl, origin }, { source: "manifest: manifest.yaml\n", configPath: file });
    expect(install.manifestPath).toBe(manifestPath);
    expect(install.manifest.brand).toMatchObject({ name: "Acme", mark: markPath });
    expect(calls).toContain(localFileUrl(origin, manifestPath));
    expect(calls).toContain(localFileUrl(origin, cachePath));
    expect(calls.some((url) => url.includes("samples/themes/"))).toBe(false);
  });

  it("still loads a package name when the config file is on disk", async () => {
    const { fetchImpl, calls } = routes(packageAssets());
    const install = await loadInstall(
      { fetch: fetchImpl, origin },
      { source: "manifest: emporion\n", configPath: "/var/talks/acme/web-slider.config.yaml" },
    );
    expect(install.manifestPath).toBe(packageManifestPath);
    expect(calls).toContain(`${origin}${packageManifestPath}`);
    expect(calls.some((url) => url.includes("/__slider/local-file"))).toBe(false);
  });

  it("checks manifest.resolved.json beside a disk manifest", async () => {
    const file = "/var/talks/acme/web-slider.config.yaml";
    const cachePath = "/var/talks/acme/manifest.resolved.json";
    const hash = await sourceHash(acmeManifest);
    const resolved = resolveManifest(parseManifest(acmeManifest), hash);
    const cacheUrl = localFileUrl(origin, cachePath);
    const stale = routes({
      ...acmeRoutes(acmeManifest),
      [cacheUrl]: {
        status: 200,
        type: "application/json",
        body: canonicalJson({ ...resolved, sourceHash: "a".repeat(64) }),
      },
    });
    const install = await loadInstall({ fetch: stale.fetchImpl, origin }, { source: "manifest: manifest.yaml\n", configPath: file });
    expect(install.manifest.brand).toMatchObject({ name: "Acme" });

    const divergent = routes({
      ...acmeRoutes(acmeManifest),
      [cacheUrl]: {
        status: 200,
        type: "application/json",
        body: canonicalJson({
          ...resolved,
          theme: { ...resolved.theme, background: "#000000" },
        }),
      },
    });
    await expect(
      loadInstall({ fetch: divergent.fetchImpl, origin }, { source: "manifest: manifest.yaml\n", configPath: file }),
    ).rejects.toThrow(new RegExp(`does not match the manifest: ${cachePath}`));
  });
});

const acmeManifest = `
brand:
  name: Acme
  wordmark: ACME
  accent: "#112233"
  highlight: "#445566"
  mark: mark.svg
fonts:
  Inter:
    regular: fonts/Inter-Regular.ttf
    semibold: fonts/Inter-SemiBold.ttf
`;

function acmeRoutes(manifest: string): Record<string, { status: number; body: string; type?: string }> {
  return {
    [localFileUrl(origin, "/var/talks/acme/manifest.yaml")]: { status: 200, body: manifest },
    [localFileUrl(origin, "/var/talks/acme/mark.svg")]: { status: 200, type: "image/svg+xml", body: "<svg></svg>" },
    [localFileUrl(origin, "/var/talks/acme/fonts/Inter-Regular.ttf")]: { status: 200, type: "font/ttf", body: "ttf" },
    [localFileUrl(origin, "/var/talks/acme/fonts/Inter-SemiBold.ttf")]: { status: 200, type: "font/ttf", body: "ttf" },
  };
}
