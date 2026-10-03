import YAML from "js-yaml";
import { ZodError, z } from "zod";
import {
  brandSchema,
  packageNameSchema,
  DEFAULT_THEME,
  fontsSchema,
  FONT_NAMES,
  missingFontNames,
  themeSchema,
  type BrandInput,
  type BrandObject,
  type Deck,
  type FontMap,
  type ThemeInput,
} from "./schema";

/** Package loaded when web-slider.config.yaml is absent. The shipped config names the package when that file is present. */
const defaultPackageName = "emporion";

const manifestPathSchema = z
  .string()
  .min(1)
  .refine((value) => isPackageName(value) || isManifestPath(value), {
    message: "must be a package name or a path such as themes/northwind/manifest.yaml",
  });

export const configSchema = z
  .object({
    manifest: manifestPathSchema,
  })
  .strict();

export const manifestSchema = z
  .object({
    brand: brandSchema,
    theme: themeSchema.optional(),
    fonts: fontsSchema.optional(),
    aspect: z.enum(["16:9", "4:3"]).optional(),
    showSlideNumber: z.boolean().optional(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    for (const name of missingFontNames(manifest.theme, manifest.fonts)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fonts", name],
        message: `font "${name}" needs a fonts entry with a regular file. Built-in faces are ${FONT_NAMES.join(", ")}.`,
      });
    }
  });

export const resolvedManifestSchema = z
  .object({
    sourceHash: z.string().regex(/^[0-9a-f]{64}$/),
    brand: brandSchema,
    theme: themeSchema,
    fonts: fontsSchema.optional(),
    aspect: z.enum(["16:9", "4:3"]),
    showSlideNumber: z.boolean(),
  })
  .strict();

export type Manifest = z.infer<typeof manifestSchema>;
export type ResolvedManifest = z.infer<typeof resolvedManifestSchema>;

export type Install = {
  manifestPath: string;
  manifest: ResolvedManifest;
  assetUrls: Map<string, string>;
};

export function completeTheme(theme: ThemeInput | undefined): ThemeInput {
  const resolved = {
    background: theme?.background ?? DEFAULT_THEME.background,
    surface: theme?.surface ?? DEFAULT_THEME.surface,
    text: theme?.text ?? DEFAULT_THEME.text,
    muted: theme?.muted ?? DEFAULT_THEME.muted,
    accent: theme?.accent ?? DEFAULT_THEME.accent,
    fontHeading: theme?.fontHeading ?? DEFAULT_THEME.fontHeading,
    fontBody: theme?.fontBody ?? DEFAULT_THEME.fontBody,
    fontMono: theme?.fontMono ?? DEFAULT_THEME.fontMono,
    align: theme?.align ?? DEFAULT_THEME.align,
    headingScale: theme?.headingScale ?? DEFAULT_THEME.headingScale,
    radius: theme?.radius ?? DEFAULT_THEME.radius,
    type: { ...DEFAULT_THEME.type, ...definedFields(theme?.type) },
  };
  return {
    ...resolved,
    ...(theme?.highlight ? { highlight: theme.highlight } : {}),
    ...(theme?.chrome ? { chrome: theme.chrome } : {}),
    ...(theme?.chromeLight ? { chromeLight: definedFields(theme.chromeLight) } : {}),
    ...(theme?.chromeDark ? { chromeDark: definedFields(theme.chromeDark) } : {}),
  };
}

export function resolveManifest(manifest: Manifest, sourceHash: string): ResolvedManifest {
  return {
    sourceHash,
    brand: manifest.brand,
    theme: completeTheme(manifest.theme),
    ...(manifest.fonts ? { fonts: manifest.fonts } : {}),
    aspect: manifest.aspect ?? "16:9",
    showSlideNumber: manifest.showSlideNumber ?? true,
  };
}

export function presentTalk(talk: Deck, manifest: ResolvedManifest): Deck {
  return {
    ...talk,
    aspect: talk.aspect ?? manifest.aspect,
    showSlideNumber: talk.showSlideNumber ?? manifest.showSlideNumber,
    brand: manifest.brand,
    theme: manifest.theme,
    ...(manifest.fonts ? { fonts: manifest.fonts } : {}),
  };
}

export function manifestAssetRefs(manifest: { brand: BrandInput; fonts?: FontMap }): string[] {
  const refs = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value || value.startsWith("https://") || value.startsWith("data:")) return;
    refs.add(value);
  };
  if (typeof manifest.brand === "string") {
    throw new Error(
      `Brand "${manifest.brand}" is a package name and was not loaded. A missing package is not replaced with another brand.`,
    );
  }
  add(manifest.brand.mark);
  add(manifest.brand.markDark);
  for (const face of Object.values(manifest.fonts ?? {})) {
    add(face.regular);
    add(face.semibold);
  }
  return [...refs];
}

export function parseConfig(source: string) {
  return parseYaml(source, configSchema, "Config", "Config must be a YAML mapping.");
}

export function parseManifest(source: string): Manifest {
  return parseYaml(source, manifestSchema, "Manifest", "Manifest must be a YAML mapping.");
}

export async function sourceHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function loadInstall(env: { fetch: typeof fetch; origin: string }): Promise<Install> {
  const origin = env.origin.endsWith("/") ? env.origin : `${env.origin}/`;
  const configUrl = new URL("web-slider.config.yaml", origin);
  const configResponse = await env.fetch(configUrl);
  if (configResponse.status === 404) {
    return loadManifestAt(env, origin, packageManifestPath(defaultPackageName), missingPackage);
  }
  if (!configResponse.ok) {
    throw new Error(`Config failed to load (${configResponse.status}): web-slider.config.yaml`);
  }
  const configBody = await readBody(configResponse);
  if (configBody.html) {
    return loadManifestAt(env, origin, packageManifestPath(defaultPackageName), missingPackage);
  }
  const config = parseConfig(configBody.text);
  if (isPackageName(config.manifest)) {
    return loadManifestAt(env, origin, packageManifestPath(config.manifest), missingPackage);
  }
  return loadManifestAt(env, origin, config.manifest, missingManifest);
}

async function loadManifestAt(
  env: { fetch: typeof fetch; origin: string },
  origin: string,
  manifestPath: string,
  missing: (path: string) => Error,
): Promise<Install> {
  const manifestUrl = new URL(manifestPath, origin);
  const loaded = await readManifestFile(env, origin, manifestPath, missing);
  const hash = await sourceHash(loaded.yaml);
  const followed = await followBrand(env, origin, loaded.manifest.brand, manifestPath, loaded.manifest.fonts, [manifestPath]);
  const assembled = assembleBrand(manifestPath, loaded.manifest.fonts, followed);
  const resolved = resolveManifest(
    {
      ...loaded.manifest,
      brand: assembled.brand,
      ...(assembled.fonts ? { fonts: assembled.fonts } : {}),
    },
    hash,
  );
  await checkResolvedCache(env.fetch, manifestUrl, hash, resolved);
  return finish(resolved, manifestPath, env.fetch, origin);
}

async function readManifestFile(
  env: { fetch: typeof fetch; origin: string },
  origin: string,
  manifestPath: string,
  missing: (path: string) => Error,
): Promise<{ yaml: string; manifest: Manifest }> {
  const manifestUrl = new URL(manifestPath, origin);
  const manifestResponse = await env.fetch(manifestUrl);
  if (manifestResponse.status === 404) throw missing(manifestPath);
  if (!manifestResponse.ok) {
    throw new Error(`Manifest failed to load (${manifestResponse.status}): ${manifestPath}`);
  }
  const manifestBody = await readBody(manifestResponse);
  if (manifestBody.html) throw missing(manifestPath);
  return { yaml: manifestBody.text, manifest: parseManifest(manifestBody.text) };
}

async function followBrand(
  env: { fetch: typeof fetch; origin: string },
  origin: string,
  brand: BrandInput,
  manifestPath: string,
  fonts: FontMap | undefined,
  seen: string[],
): Promise<{ brand: BrandObject; fonts?: FontMap; manifestPath: string }> {
  if (typeof brand !== "string") {
    return { brand, fonts, manifestPath };
  }
  const next = packageManifestPath(brand);
  if (seen.includes(next)) {
    throw new Error(
      `Brand package cycle: ${[...seen, next].join(" → ")}. A package name is not replaced with another brand.`,
    );
  }
  const loaded = await readManifestFile(env, origin, next, missingPackage);
  return followBrand(env, origin, loaded.manifest.brand, next, loaded.manifest.fonts, [...seen, next]);
}

function assembleBrand(
  rootPath: string,
  rootFonts: FontMap | undefined,
  followed: { brand: BrandObject; fonts?: FontMap; manifestPath: string },
): { brand: BrandObject; fonts?: FontMap } {
  const brand = locateBrand(followed.brand, followed.manifestPath);
  const fonts = {
    ...(followed.manifestPath === rootPath ? {} : locateFonts(followed.fonts, followed.manifestPath)),
    ...locateFonts(rootFonts, rootPath),
  };
  return { brand, ...(Object.keys(fonts).length > 0 ? { fonts } : {}) };
}

function locateBrand(brand: BrandObject, manifestPath: string): BrandObject {
  return {
    ...brand,
    mark: locateRef(brand.mark, manifestPath),
    ...(brand.markDark ? { markDark: locateRef(brand.markDark, manifestPath) } : {}),
  };
}

function locateFonts(fonts: FontMap | undefined, manifestPath: string): FontMap {
  const located: FontMap = {};
  for (const [name, face] of Object.entries(fonts ?? {})) {
    located[name] = {
      regular: locateRef(face.regular, manifestPath),
      ...(face.semibold ? { semibold: locateRef(face.semibold, manifestPath) } : {}),
    };
  }
  return located;
}

function locateRef(ref: string, manifestPath: string): string {
  if (ref.startsWith("https://") || ref.startsWith("data:") || ref.startsWith("themes/")) return ref;
  const slash = manifestPath.lastIndexOf("/");
  const dir = slash === -1 ? "" : manifestPath.slice(0, slash + 1);
  return `${dir}${ref}`;
}

function packageManifestPath(name: string): string {
  return `themes/${name}/manifest.yaml`;
}

function isPackageName(value: string): boolean {
  return packageNameSchema.safeParse(value).success;
}

function parseYaml<T>(source: string, schema: z.ZodType<T>, label: string, mappingError: string): T {
  if (source.trim() === "") throw new Error(`${label} YAML is empty.`);
  let loaded: unknown;
  try {
    loaded = YAML.load(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label.toLowerCase()} YAML:\n${message}`);
  }
  if (loaded === null || typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error(mappingError);
  }
  try {
    return schema.parse(loaded);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => `${issue.path.join(".") || `(${label.toLowerCase()})`}: ${issue.message}`).join("\n");
      throw new Error(`${label} failed validation:\n${details}`);
    }
    throw error;
  }
}

function missingManifest(path: string): Error {
  return new Error(
    `Manifest not found: ${path}. web-slider.config.yaml points at this file. A missing manifest is not replaced with another package.`,
  );
}

function missingPackage(path: string): Error {
  return new Error(
    `Theme package not found: ${path}. A package name loads themes/<name>/manifest.yaml. A missing package is not replaced with another brand.`,
  );
}

async function readBody(response: Response): Promise<{ text: string; html: boolean }> {
  const type = response.headers.get("content-type") ?? "";
  const text = await response.text();
  return { text, html: type.includes("text/html") || text.trimStart().startsWith("<") };
}

function isManifestPath(value: string): boolean {
  if (value.startsWith("/") || value.includes("\\") || value.includes("://") || value.split("/").includes("..")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9_./-]*\.ya?ml$/.test(value);
}

function definedFields<T extends Record<string, unknown>>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

async function checkResolvedCache(
  fetchImpl: typeof fetch,
  manifestUrl: URL,
  hash: string,
  resolved: ResolvedManifest,
): Promise<void> {
  const cacheUrl = new URL(manifestUrl.href);
  cacheUrl.pathname = cacheUrl.pathname.replace(/[^/]+$/, "manifest.resolved.json");
  const response = await fetchImpl(cacheUrl);
  if (response.status === 404 || response.status === 204) return;
  if (!response.ok) {
    throw new Error(`Theme cache failed to load (${response.status}): ${cacheUrl.pathname}`);
  }
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html")) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Theme cache is invalid: ${cacheUrl.pathname}. It is a system file, not a file to edit. Remove it.\n${message}`,
    );
  }
  let cache: ResolvedManifest;
  try {
    cache = resolvedManifestSchema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => `${issue.path.join(".") || "(cache)"}: ${issue.message}`).join("\n");
      throw new Error(`Theme cache failed validation: ${cacheUrl.pathname}. It is a system file, not a file to edit. Remove it.\n${details}`);
    }
    throw error;
  }
  if (cache.sourceHash !== hash) return;
  if (canonicalJson(cache) !== canonicalJson(resolved)) {
    throw new Error(
      `Theme cache does not match the manifest: ${cacheUrl.pathname}. The manifest is the source. Remove the cache; do not edit it.`,
    );
  }
}

async function finish(
  manifest: ResolvedManifest,
  manifestPath: string,
  fetchImpl: typeof fetch,
  origin: string,
): Promise<Install> {
  return {
    manifestPath,
    manifest,
    assetUrls: await bindManifestAssets(manifest, fetchImpl, origin),
  };
}

async function bindManifestAssets(
  manifest: ResolvedManifest,
  fetchImpl: typeof fetch,
  origin: string,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const refs = manifestAssetRefs(manifest);
  if (refs.length === 0) return urls;
  const root = origin.endsWith("/") ? origin : `${origin}/`;
  for (const ref of refs) {
    const assetUrl = new URL(ref, root);
    const response = await fetchImpl(assetUrl);
    if (!response.ok) {
      throw new Error(`Theme asset failed to load (${response.status}): ${ref}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new Error(`Theme asset is empty: ${ref}`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (isHtmlDocument(type, bytes)) {
      throw new Error(`Theme asset not found: ${ref}. The server returned HTML instead of the file.`);
    }
    urls.set(ref, assetUrl.href);
  }
  return urls;
}

function isHtmlDocument(type: string, bytes: Uint8Array): boolean {
  if (type.toLowerCase().includes("text/html")) return true;
  const head = new TextDecoder().decode(bytes.subarray(0, 64)).trimStart().toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}
