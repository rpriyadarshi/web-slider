import { z } from "zod";

export const FONT_NAMES = ["Inter", "Source Serif 4", "JetBrains Mono"] as const;
export type FontName = (typeof FONT_NAMES)[number];

export function isBuiltInFont(name: string): name is FontName {
  return (FONT_NAMES as readonly string[]).includes(name);
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a #rrggbb color");

export const colorsSchema = z
  .object({
    background: hexColor.optional(),
    surface: hexColor.optional(),
    text: hexColor.optional(),
    muted: hexColor.optional(),
    accent: hexColor.optional(),
  })
  .strict();

export const chromeColorsSchema = z
  .object({
    ground: hexColor.optional(),
    paper: hexColor.optional(),
    text: hexColor.optional(),
    muted: hexColor.optional(),
    line: hexColor.optional(),
  })
  .strict();

const fontNameSchema = z
  .string()
  .min(1)
  .max(80)
  .refine((name) => !/["'<>\n]/.test(name), "font name cannot contain quotes");

export const themeSchema = colorsSchema
  .extend({
    fontHeading: fontNameSchema.optional(),
    fontBody: fontNameSchema.optional(),
    fontMono: fontNameSchema.optional(),
    align: z.enum(["left", "center"]).optional(),
    headingScale: z.number().positive().max(3).optional(),
    radius: z.number().nonnegative().max(48).optional(),
    highlight: hexColor.optional(),
    chrome: z.enum(["light", "dark"]).optional(),
    chromeLight: chromeColorsSchema.optional(),
    chromeDark: chromeColorsSchema.optional(),
  })
  .strict();

const stepField = z.number().int().nonnegative().optional();

export const assetRefSchema = z.string().refine((src) => isAssetRef(src), {
  message:
    "must be an https URL, a data URI, or a package path such as brand/mark.svg. A filesystem path or ../ cannot be read.",
});

export function isAssetRef(src: string): boolean {
  if (src.startsWith("https://") || src.startsWith("data:")) return true;
  if (src.startsWith("/") || src.includes("\\") || src.split("/").includes("..")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(src);
}

const idSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "must use letters, numbers, hyphens, or underscores");

const bulletItemSchema = z
  .object({
    text: z.string().min(1),
    step: stepField,
  })
  .strict();

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().min(1), step: stepField }).strict(),
  z
    .object({
      type: z.literal("bullets"),
      items: z.array(bulletItemSchema).min(1),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("quote"),
      text: z.string().min(1),
      attribution: z.string().min(1).optional(),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("code"),
      code: z.string(),
      language: z.string().min(1).optional(),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("image"),
      src: assetRefSchema,
      alt: z.string().min(1).optional(),
      step: stepField,
    })
    .strict(),
  z.object({ type: z.literal("callout"), text: z.string().min(1), step: stepField }).strict(),
  z.object({ type: z.literal("divider"), step: stepField }).strict(),
  z
    .object({
      type: z.literal("numbered"),
      items: z.array(bulletItemSchema).min(1),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("table"),
      headers: z.array(z.string().min(1)).min(1),
      rows: z.array(z.array(z.string())).min(1),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("link"),
      text: z.string().min(1),
      href: z.string().optional(),
      slide: idSchema.optional(),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("video"),
      src: z.string().min(1),
      title: z.string().min(1).optional(),
      step: stepField,
    })
    .strict(),
  z
    .object({
      type: z.literal("chart"),
      kind: z.enum(["bar", "column"]),
      labels: z.array(z.string().min(1)).min(1).max(12),
      values: z.array(z.number().finite()).min(1).max(12),
      step: stepField,
    })
    .strict(),
]);

const optionsSchema = z.array(z.string().min(1)).min(2);

export const widgetSchema = z.discriminatedUnion("type", [
  z
    .object({
      id: idSchema,
      type: z.literal("radio"),
      prompt: z.string().min(1),
      options: optionsSchema,
      answer: z.string().optional(),
    })
    .strict(),
  z
    .object({
      id: idSchema,
      type: z.literal("checkbox"),
      prompt: z.string().min(1),
      options: optionsSchema,
      answer: z.array(z.string()).optional(),
    })
    .strict(),
  z
    .object({
      id: idSchema,
      type: z.literal("select"),
      prompt: z.string().min(1),
      options: optionsSchema,
      answer: z.string().optional(),
    })
    .strict(),
  z
    .object({
      id: idSchema,
      type: z.literal("text"),
      prompt: z.string().min(1),
      answer: z.string().optional(),
    })
    .strict(),
  z
    .object({
      id: idSchema,
      type: z.literal("scale"),
      prompt: z.string().min(1),
      answer: z.number().int().min(1).max(5).optional(),
    })
    .strict(),
]);

export const slideSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    layout: z.enum(["title", "section", "content", "quote"]),
    subtitle: z.string().optional(),
    notes: z.string().optional(),
    takenNotes: z.string().optional(),
    hidden: z.boolean().optional(),
    autoAdvance: z.number().positive().max(3600).optional(),
    theme: colorsSchema.optional(),
    blocks: z.array(blockSchema).optional(),
    side: z.array(blockSchema).optional(),
    widgets: z.array(widgetSchema).optional(),
  })
  .strict();

const fontFileSchema = z
  .object({
    regular: assetRefSchema,
    semibold: assetRefSchema.optional(),
  })
  .strict();

export const customBrandSchema = z
  .object({
    name: z.string().min(1),
    wordmark: z.string().min(1),
    tail: z.string().min(1).optional(),
    accent: hexColor,
    highlight: hexColor,
    mark: assetRefSchema,
    markDark: assetRefSchema.optional(),
  })
  .strict();

export const brandSchema = z.union([z.literal("emporion"), customBrandSchema]);

export const deckSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    author: z.string().min(1).optional(),
    footer: z.string().optional(),
    showSlideNumber: z.boolean().optional(),
    aspect: z.enum(["16:9", "4:3"]).optional(),
    brand: brandSchema.optional(),
    theme: themeSchema.optional(),
    fonts: z.record(fontNameSchema, fontFileSchema).optional(),
    slides: z.array(slideSchema).min(1),
  })
  .strict()
  .superRefine((deck, ctx) => {
    deck.slides.forEach((slide, slideIndex) => {
      (["blocks", "side"] as const).forEach((place) => {
      slide[place]?.forEach((block, blockIndex) => {
        if (block.type === "link") {
          const hasHref = block.href !== undefined;
          const hasSlide = block.slide !== undefined;
          if (hasHref === hasSlide) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["slides", slideIndex, place, blockIndex],
              message: "link needs either an https href or a slide id",
            });
          }
          if (block.href !== undefined && !block.href.startsWith("https://")) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["slides", slideIndex, place, blockIndex, "href"],
              message: "href must be an https URL",
            });
          }
          if (block.slide !== undefined && !deck.slides.some((candidate) => candidate.id === block.slide)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["slides", slideIndex, place, blockIndex, "slide"],
              message: `unknown slide id "${block.slide}"`,
            });
          }
        }
        if (block.type === "video" && !block.src.startsWith("https://")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["slides", slideIndex, place, blockIndex, "src"],
            message: "video src must be an https URL",
          });
        }
        if (block.type === "chart" && block.labels.length !== block.values.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["slides", slideIndex, place, blockIndex, "values"],
            message: `chart has ${block.values.length} values but ${block.labels.length} labels`,
          });
        }
        if (block.type === "table") {
          block.rows.forEach((row, rowIndex) => {
            if (row.length !== block.headers.length) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["slides", slideIndex, place, blockIndex, "rows", rowIndex],
                message: `row has ${row.length} cells but the table has ${block.headers.length} headers`,
              });
            }
          });
        }
      });
      });
    });

    for (const name of [deck.theme?.fontHeading, deck.theme?.fontBody, deck.theme?.fontMono]) {
      if (name && !isBuiltInFont(name) && !deck.fonts?.[name]?.regular) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fonts", name],
          message: `font "${name}" needs a fonts entry with a regular file. Built-in faces are ${FONT_NAMES.join(", ")}.`,
        });
      }
    }

    const slideIds = new Set<string>();
    deck.slides.forEach((slide, slideIndex) => {
      if (slideIds.has(slide.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slides", slideIndex, "id"],
          message: `duplicate slide id "${slide.id}"`,
        });
      }
      slideIds.add(slide.id);

      const widgetIds = new Set<string>();
      slide.widgets?.forEach((widget, widgetIndex) => {
        if (widgetIds.has(widget.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["slides", slideIndex, "widgets", widgetIndex, "id"],
            message: `duplicate widget id "${widget.id}"`,
          });
        }
        widgetIds.add(widget.id);

        if ((widget.type === "radio" || widget.type === "select") && widget.answer !== undefined) {
          if (!widget.options.includes(widget.answer)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["slides", slideIndex, "widgets", widgetIndex, "answer"],
              message: "answer is not one of the options",
            });
          }
        }

        if (widget.type === "checkbox" && widget.answer) {
          for (const value of widget.answer) {
            if (!widget.options.includes(value)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["slides", slideIndex, "widgets", widgetIndex, "answer"],
                message: `answer "${value}" is not one of the options`,
              });
            }
          }
        }
      });
    });
  });

export type Colors = z.infer<typeof colorsSchema>;
export type ThemeInput = z.infer<typeof themeSchema>;
export type Block = z.infer<typeof blockSchema>;
export type BulletItem = z.infer<typeof bulletItemSchema>;
export type Widget = z.infer<typeof widgetSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type Deck = z.infer<typeof deckSchema>;

export const DEFAULT_THEME = {
  background: "#111418",
  surface: "#1c2430",
  text: "#f2f4f8",
  muted: "#9aa6b8",
  accent: "#6ea8fe",
  fontHeading: "Source Serif 4",
  fontBody: "Inter",
  fontMono: "JetBrains Mono",
  align: "left",
  headingScale: 1,
  radius: 12,
} as const satisfies {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  fontHeading: FontName;
  fontBody: FontName;
  fontMono: FontName;
  align: "left" | "center";
  headingScale: number;
  radius: number;
};

export type ResolvedTheme = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  fontHeading: string;
  fontBody: string;
  fontMono: string;
  align: "left" | "center";
  headingScale: number;
  radius: number;
};

function definedFields<T extends Record<string, unknown>>(value: T | undefined): Partial<T> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

export function resolveTheme(theme: ThemeInput | undefined, slideColors?: Colors): ResolvedTheme {
  return {
    ...DEFAULT_THEME,
    ...definedFields(theme),
    ...definedFields(slideColors),
  };
}
