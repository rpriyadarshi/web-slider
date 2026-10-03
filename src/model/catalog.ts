import YAML from "js-yaml";
import { ZodError, z } from "zod";

const siteYamlPath = z
  .string()
  .min(1)
  .refine((value) => isSiteYamlPath(value), {
    message: "must be a site path such as samples/examples/harbor/briefing.yaml",
  });

const catalogEntrySchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "must use letters, numbers, hyphens, or underscores"),
    title: z.string().min(1),
    path: siteYamlPath,
  })
  .strict();

export const catalogSchema = z
  .object({
    installs: z.array(catalogEntrySchema).min(1),
    examples: z.array(catalogEntrySchema).min(1),
  })
  .strict()
  .superRefine((catalog, ctx) => {
    for (const list of ["installs", "examples"] as const) {
      const seen = new Set<string>();
      catalog[list].forEach((entry, index) => {
        if (seen.has(entry.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [list, index, "id"],
            message: `duplicate id "${entry.id}"`,
          });
        }
        seen.add(entry.id);
      });
    }
  });

export type CatalogEntry = z.infer<typeof catalogEntrySchema>;
export type Catalog = z.infer<typeof catalogSchema>;

export const CATALOG_PATH = "samples/catalog.yaml";

export function parseCatalog(source: string): Catalog {
  if (source.trim() === "") throw new Error("Catalog YAML is empty.");
  let loaded: unknown;
  try {
    loaded = YAML.load(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid catalog YAML:\n${message}`);
  }
  if (loaded === null || typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error("Catalog must be a YAML mapping.");
  }
  try {
    return catalogSchema.parse(loaded);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => `${issue.path.join(".") || "(catalog)"}: ${issue.message}`).join("\n");
      throw new Error(`Catalog failed validation:\n${details}`);
    }
    throw error;
  }
}

export async function loadCatalog(env: { fetch: typeof fetch; origin: string }): Promise<Catalog> {
  const origin = env.origin.endsWith("/") ? env.origin : `${env.origin}/`;
  const response = await env.fetch(new URL(CATALOG_PATH, origin));
  if (!response.ok) {
    throw new Error(`Catalog failed to load (${response.status}): ${CATALOG_PATH}`);
  }
  const text = await response.text();
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/html") || text.trimStart().startsWith("<")) {
    throw new Error(`Catalog not found: ${CATALOG_PATH}. The server returned HTML instead of the file.`);
  }
  return parseCatalog(text);
}

function isSiteYamlPath(value: string): boolean {
  if (value.startsWith("/") || value.includes("\\") || value.includes("://") || value.split("/").includes("..")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9_./-]*\.ya?ml$/.test(value);
}
