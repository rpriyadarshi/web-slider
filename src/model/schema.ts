import { z } from "zod";

export const FONT_NAMES = ["Inter", "Source Serif 4", "JetBrains Mono"] as const;
export type FontName = (typeof FONT_NAMES)[number];

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

export const themeSchema = colorsSchema
  .extend({
    fontHeading: z.enum(FONT_NAMES).optional(),
    fontBody: z.enum(FONT_NAMES).optional(),
    fontMono: z.enum(FONT_NAMES).optional(),
    align: z.enum(["left", "center"]).optional(),
    headingScale: z.number().positive().max(3).optional(),
    radius: z.number().nonnegative().max(48).optional(),
  })
  .strict();

const stepField = z.number().int().nonnegative().optional();

const imageSrc = z
  .string()
  .refine(
    (src) => src.startsWith("https://") || src.startsWith("data:"),
    "Image src must be an https URL or a data URI. A file path cannot be read in the browser.",
  );

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
      src: imageSrc,
      alt: z.string().min(1).optional(),
      step: stepField,
    })
    .strict(),
  z.object({ type: z.literal("callout"), text: z.string().min(1), step: stepField }).strict(),
  z.object({ type: z.literal("divider"), step: stepField }).strict(),
]);

const idSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "must use letters, numbers, hyphens, or underscores");

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
    theme: colorsSchema.optional(),
    blocks: z.array(blockSchema).optional(),
    side: z.array(blockSchema).optional(),
    widgets: z.array(widgetSchema).optional(),
  })
  .strict();

export const customBrandSchema = z
  .object({
    name: z.string().min(1),
    wordmark: z.string().min(1),
    accent: hexColor,
    highlight: hexColor,
    mark: imageSrc,
  })
  .strict();

export const brandSchema = z.union([z.literal("emporion"), customBrandSchema]);

export const deckSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1),
    author: z.string().min(1).optional(),
    brand: brandSchema.optional(),
    theme: themeSchema.optional(),
    slides: z.array(slideSchema).min(1),
  })
  .strict()
  .superRefine((deck, ctx) => {
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
  fontHeading: FontName;
  fontBody: FontName;
  fontMono: FontName;
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
