import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HIGHLIGHT_LANGUAGES } from "../highlight";
import { BLOCK_KINDS, WIDGET_KINDS, blockValue, widgetValue } from "../model/insert";
import { blockSchema, deckSchema, slideSchema, widgetSchema } from "../model/schema";
import { TALK, blockDoc } from "./reference";

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return unwrap(schema.unwrap());
  if (schema instanceof z.ZodDefault) return unwrap(schema.removeDefault());
  if (schema instanceof z.ZodEffects) return unwrap(schema.innerType());
  return schema;
}

describe("talk reference", () => {
  it("matches the deck and slide schemas", () => {
    if (!(deckSchema instanceof z.ZodEffects)) throw new Error("The deck schema changed shape.");
    const deckObject = deckSchema.innerType();
    if (!(deckObject instanceof z.ZodObject)) throw new Error("The deck schema changed shape.");
    expect(TALK.deck.map((field) => field.name)).toEqual(Object.keys(deckObject.shape));
    expect(TALK.slide.map((field) => field.name)).toEqual(Object.keys(slideSchema.shape));
    const layout = TALK.slide.find((field) => field.name === "layout");
    expect(layout?.optional).toBe(false);
    expect(layout?.values).toEqual(["title", "section", "content", "quote"]);
    expect(TALK.slide.find((field) => field.name === "subtitle")?.optional).toBe(true);
    const aspect = TALK.deck.find((field) => field.name === "aspect");
    expect(aspect?.values).toEqual(["16:9", "4:3"]);
  });

  it("matches every block and widget the insert menu can add", () => {
    expect(TALK.blocks.map((item) => item.type)).toEqual([...BLOCK_KINDS]);
    expect(TALK.widgets.map((item) => item.type)).toEqual([...WIDGET_KINDS]);
    expect(new Set(blockSchema.options.map((option) => option.shape.type.value))).toEqual(new Set(BLOCK_KINDS));
    expect(new Set(widgetSchema.options.map((option) => option.shape.type.value))).toEqual(new Set(WIDGET_KINDS));
    for (const option of blockSchema.options) {
      const type = String(option.shape.type.value);
      const doc = TALK.blocks.find((item) => item.type === type);
      const shape = option.shape as unknown as Record<string, z.ZodTypeAny>;
      expect(doc?.fields.map((field) => field.name)).toEqual(Object.keys(shape));
      for (const field of doc?.fields ?? []) {
        expect(field.optional).toBe(shape[field.name]!.isOptional());
        const inner = unwrap(shape[field.name]!);
        if (field.fields) {
          const nested = inner instanceof z.ZodArray ? unwrap(inner.element) : inner;
          expect(nested).toBeInstanceOf(z.ZodObject);
          expect(field.fields.map((item) => item.name)).toEqual(Object.keys((nested as z.ZodObject<z.ZodRawShape>).shape));
        }
      }
    }
    for (const option of widgetSchema.options) {
      const type = String(option.shape.type.value);
      const doc = TALK.widgets.find((item) => item.type === type);
      expect(doc?.fields.map((field) => field.name)).toEqual(Object.keys(option.shape));
    }
  });

  it("uses the insert templates as examples", () => {
    for (const type of BLOCK_KINDS) {
      const doc = TALK.blocks.find((item) => item.type === type);
      expect(doc?.example).toBe(stringify(blockValue(type)).trimEnd());
      expect(blockSchema.parse(parse(doc?.example ?? "")).type).toBe(type);
    }
    for (const type of WIDGET_KINDS) {
      const doc = TALK.widgets.find((item) => item.type === type);
      expect(doc?.example).toBe(stringify(widgetValue(type, type)).trimEnd());
      expect(widgetSchema.parse(parse(doc?.example ?? "")).type).toBe(type);
    }
  });

  it("names every language the highlighter loads", () => {
    const language = blockDoc("code").fields.find((field) => field.name === "language");
    for (const name of HIGHLIGHT_LANGUAGES) expect(language?.about).toContain(name);
  });
});
