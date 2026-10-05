import { stringify } from "yaml";
import { z } from "zod";
import { HIGHLIGHT_LANGUAGES } from "../highlight";
import { BLOCK_KINDS, BLOCK_LABEL, WIDGET_KINDS, WIDGET_LABEL, blockValue, widgetValue } from "../model/insert";
import { blockSchema, deckSchema, slideSchema, widgetSchema, type Block, type BulletItem, type Colors, type Slide, type Widget } from "../model/schema";

export type FieldDoc = {
  name: string;
  optional: boolean;
  about: string;
  values?: readonly string[];
  fields?: readonly FieldDoc[];
};

export type KindDoc = {
  group: "block" | "widget";
  type: string;
  label: string;
  about: string;
  fields: readonly FieldDoc[];
  example: string;
};

export type TalkDoc = {
  deck: readonly FieldDoc[];
  slide: readonly FieldDoc[];
  blocks: readonly KindDoc[];
  widgets: readonly KindDoc[];
};

const STEP = "Hides this until you advance to this build. The first press reveals the next step, then the next slide.";
const BLOCK_TYPE = "Which block this is.";
const WIDGET_TYPE = "Which question this is.";
const ID = "Letters, numbers, hyphens, or underscores, starting with a letter or number.";

const COLORS: { [K in keyof Colors]: string } = {
  background: "The slide background, as #rrggbb. Leave it out to use the theme.",
  surface: "The surface behind cards and code, as #rrggbb. Leave it out to use the theme.",
  text: "The main type color, as #rrggbb. Leave it out to use the theme.",
  muted: "The quiet type color, as #rrggbb. Leave it out to use the theme.",
  accent: "The accent color, as #rrggbb. Leave it out to use the theme.",
};

const ITEMS: { [K in keyof BulletItem]: string } = {
  text: "The line.",
  step: STEP,
};

type DeckTalk = z.infer<typeof deckSchema>;

const DECK: { [K in keyof DeckTalk]: string } = {
  id: ID,
  title: "The name in the toolbar.",
  author: "Shown on the title slide.",
  footer: "The line beside the lockup. The lockup itself comes from the theme.",
  showSlideNumber: "Set this only when this talk should differ from the theme.",
  aspect: "16:9 or 4:3. Set this only when this talk should differ from the theme.",
  slides: "The slides. At least one.",
};

const SLIDE: { [K in keyof Slide]: string } = {
  id: `${ID} Unique in the talk.`,
  title: "The heading on the slide.",
  layout: "How the slide is arranged.",
  subtitle: "A second line under the title.",
  notes: "The speaker script. Shown to you, not on the audience window.",
  takenNotes: "Notes taken during the talk. Leave this out of a new talk. A download puts it back.",
  hidden: "Keeps the slide in the outline. Arrow keys skip it, and every export leaves it out. A click in the outline still opens it.",
  autoAdvance: "Seconds to wait after the last build before the next slide, above 0 and at most 3600. The slide does not advance while the audience window is blank. Leave it out unless the deck runs unattended.",
  theme: "Colors for this slide only. Anything left out comes from the theme.",
  blocks: "The main column.",
  side: "A short reference beside the slide, not a second essay.",
  widgets: "Questions on the decision row. In an embedded talk that row is the feedback form.",
};

function blockFields<T extends Block["type"]>(fields: { [K in keyof Extract<Block, { type: T }>]: string }): {
  [K in keyof Extract<Block, { type: T }>]: string;
} {
  return fields;
}

const BLOCKS: { [T in Block["type"]]: { about: string; fields: { [K in keyof Extract<Block, { type: T }>]: string } } } = {
  paragraph: {
    about: "A paragraph of text.",
    fields: blockFields<"paragraph">({ type: BLOCK_TYPE, text: "The words to show.", step: STEP }),
  },
  bullets: {
    about: "A bulleted list. Each item can appear on its own build.",
    fields: blockFields<"bullets">({ type: BLOCK_TYPE, items: "The lines. At least one.", step: STEP }),
  },
  numbered: {
    about: "A numbered list. Each item can appear on its own build.",
    fields: blockFields<"numbered">({ type: BLOCK_TYPE, items: "The lines. At least one.", step: STEP }),
  },
  quote: {
    about: "A quotation, with an optional attribution.",
    fields: blockFields<"quote">({ type: BLOCK_TYPE, text: "The quotation.", attribution: "Who said it.", step: STEP }),
  },
  callout: {
    about: "A short note set apart from the paragraph.",
    fields: blockFields<"callout">({ type: BLOCK_TYPE, text: "The note.", step: STEP }),
  },
  table: {
    about: "A table. Each row has one cell per header.",
    fields: blockFields<"table">({
      type: BLOCK_TYPE,
      headers: "The column titles.",
      rows: "The body. Each row has one string cell per header.",
      step: STEP,
    }),
  },
  chart: {
    about: "A bar or column chart. Labels and values must match, and there are at most 12 of each.",
    fields: blockFields<"chart">({
      type: BLOCK_TYPE,
      kind: "Bar draws horizontal bars. Column draws vertical bars.",
      labels: "The names along the chart, at most 12.",
      values: "One number per label.",
      step: STEP,
    }),
  },
  link: {
    about: "A link to an https address or to another slide in this talk. Set one of those, not both.",
    fields: blockFields<"link">({
      type: BLOCK_TYPE,
      text: "The words to show.",
      href: "An https URL. Set this or a slide id, not both.",
      slide: "The id of a slide in this talk. Set this or an https URL, not both.",
      step: STEP,
    }),
  },
  image: {
    about: "A picture. The source is an https URL, a data URI, or a path inside the zip package.",
    fields: blockFields<"image">({
      type: BLOCK_TYPE,
      src: "An https URL, a data URI, or a path inside the zip. A path cannot start with / or contain ..",
      alt: "A description of the picture.",
      step: STEP,
    }),
  },
  video: {
    about: "A video at an https address.",
    fields: blockFields<"video">({
      type: BLOCK_TYPE,
      src: "An https URL.",
      title: "A name for the video. Exports use it when they cannot embed the video.",
      step: STEP,
    }),
  },
  code: {
    about: "Source code. Name a language to highlight it, or leave the language out for plain text.",
    fields: blockFields<"code">({
      type: BLOCK_TYPE,
      code: "The source to show.",
      language: `Leave this out for plain text. The live view highlights ${HIGHLIGHT_LANGUAGES.join(", ")}. Any other name fails when the slide is shown.`,
      step: STEP,
    }),
  },
  divider: {
    about: "A horizontal rule.",
    fields: blockFields<"divider">({ type: BLOCK_TYPE, step: STEP }),
  },
};

function widgetFields<T extends Widget["type"]>(fields: { [K in keyof Extract<Widget, { type: T }>]: string }): {
  [K in keyof Extract<Widget, { type: T }>]: string;
} {
  return fields;
}

const CHOICE = {
  id: `${ID} Unique on this slide.`,
  type: WIDGET_TYPE,
  prompt: "The question shown on the decision row.",
  options: "At least two choices.",
} as const;

const WIDGETS: { [T in Widget["type"]]: { about: string; fields: { [K in keyof Extract<Widget, { type: T }>]: string } } } = {
  radio: {
    about: "One choice from the options.",
    fields: widgetFields<"radio">({ ...CHOICE, answer: "The chosen option. Leave it out of a new talk. It is recorded while you present." }),
  },
  checkbox: {
    about: "Any number of the options.",
    fields: widgetFields<"checkbox">({ ...CHOICE, answer: "The chosen options. Leave them out of a new talk." }),
  },
  select: {
    about: "One choice from a menu of the options.",
    fields: widgetFields<"select">({ ...CHOICE, answer: "The chosen option. Leave it out of a new talk. It is recorded while you present." }),
  },
  text: {
    about: "A short written answer.",
    fields: widgetFields<"text">({
      id: CHOICE.id,
      type: WIDGET_TYPE,
      prompt: CHOICE.prompt,
      answer: "What was typed. Leave it out of a new talk.",
    }),
  },
  scale: {
    about: "A rating from 1 to 5. Do not add options.",
    fields: widgetFields<"scale">({
      id: CHOICE.id,
      type: WIDGET_TYPE,
      prompt: CHOICE.prompt,
      answer: "A whole number from 1 to 5. Leave it out of a new talk.",
    }),
  },
};

const NESTED: Record<string, Record<string, string>> = {
  theme: COLORS,
  items: ITEMS,
};

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) return unwrap(schema.unwrap());
  if (schema instanceof z.ZodDefault) return unwrap(schema.removeDefault());
  if (schema instanceof z.ZodEffects) return unwrap(schema.innerType());
  return schema;
}

function describeObject(shape: z.ZodRawShape, about: Record<string, string>): FieldDoc[] {
  const names = Object.keys(shape);
  for (const name of names) {
    if (typeof about[name] !== "string") throw new Error(`No help for field ${name}.`);
  }
  for (const name of Object.keys(about)) {
    if (!(name in shape)) throw new Error(`Help describes ${name}, which is not in the schema.`);
  }
  return names.map((name) => describeField(name, shape[name]!, about[name]!));
}

function describeField(name: string, schema: z.ZodTypeAny, about: string): FieldDoc {
  const optional = schema.isOptional();
  const inner = unwrap(schema);
  const doc: FieldDoc = { name, optional, about };
  if (inner instanceof z.ZodLiteral) {
    doc.values = [String(inner.value)];
  } else if (inner instanceof z.ZodEnum) {
    doc.values = [...inner.options];
  } else if (inner instanceof z.ZodString || inner instanceof z.ZodNumber || inner instanceof z.ZodBoolean) {
    return doc;
  } else if (inner instanceof z.ZodObject) {
    const fields = NESTED[name];
    if (!fields) throw new Error(`No help for nested object ${name}.`);
    doc.fields = describeObject(inner.shape, fields);
  } else if (inner instanceof z.ZodArray) {
    const element = unwrap(inner.element);
    if (element instanceof z.ZodString || element instanceof z.ZodNumber) return doc;
    if (element instanceof z.ZodArray) {
      const deep = unwrap(element.element);
      if (!(deep instanceof z.ZodString)) throw new Error(`No help for the rows of ${name}.`);
      return doc;
    }
    if (element instanceof z.ZodDiscriminatedUnion || name === "slides") return doc;
    if (element instanceof z.ZodObject) {
      const fields = NESTED[name];
      if (!fields) throw new Error(`No help for list ${name}.`);
      doc.fields = describeObject(element.shape, fields);
      return doc;
    }
    throw new Error(`No help for the values of ${name} (${element.constructor.name}).`);
  } else {
    throw new Error(`No help for ${name} (${inner.constructor.name}).`);
  }
  return doc;
}

function literalType(schema: z.ZodTypeAny): string {
  const inner = unwrap(schema);
  if (!(inner instanceof z.ZodLiteral) || typeof inner.value !== "string") {
    throw new Error("A block or widget is missing its type name.");
  }
  return inner.value;
}

function unionOptions(schema: z.ZodTypeAny): ReadonlyArray<z.ZodObject<z.ZodRawShape>> {
  if (!(schema instanceof z.ZodDiscriminatedUnion)) {
    throw new Error(`Expected a discriminated union, got ${schema.constructor.name}.`);
  }
  return schema.options;
}

function kinds(
  group: "block" | "widget",
  schema: z.ZodTypeAny,
  docs: Record<string, { about: string; fields: Record<string, string> }>,
  labels: Record<string, string>,
  order: readonly string[],
  exampleFor: (type: string) => unknown,
): KindDoc[] {
  const built = new Map<string, KindDoc>();
  for (const option of unionOptions(schema)) {
    const type = literalType(option.shape.type!);
    const doc = docs[type];
    if (!doc) throw new Error(`No help for ${group} ${type}.`);
    built.set(type, {
      group,
      type,
      label: labels[type] ?? type,
      about: doc.about,
      fields: describeObject(option.shape, doc.fields),
      example: stringify(exampleFor(type)).trimEnd(),
    });
  }
  const ordered = order.map((type) => {
    const found = built.get(type);
    if (!found) throw new Error(`The insert menu lists ${type}, which has no help.`);
    return found;
  });
  if (ordered.length !== built.size) throw new Error(`The schema has a ${group} the insert menu does not list.`);
  for (const type of Object.keys(docs)) {
    if (!built.has(type)) throw new Error(`Help describes ${group} ${type}, which is not in the schema.`);
  }
  return ordered;
}

function buildTalk(): TalkDoc {
  if (!(deckSchema instanceof z.ZodEffects)) throw new Error("The deck schema changed shape.");
  const deckObject = deckSchema.innerType();
  if (!(deckObject instanceof z.ZodObject)) throw new Error("The deck schema changed shape.");
  if (!(slideSchema instanceof z.ZodObject)) throw new Error("The slide schema changed shape.");
  return {
    deck: describeObject(deckObject.shape, DECK),
    slide: describeObject(slideSchema.shape, SLIDE),
    blocks: kinds("block", blockSchema, BLOCKS, BLOCK_LABEL, BLOCK_KINDS, (type) => blockValue(type as Block["type"])),
    widgets: kinds("widget", widgetSchema, WIDGETS, WIDGET_LABEL, WIDGET_KINDS, (type) => widgetValue(type as Widget["type"], type)),
  };
}

export const TALK: TalkDoc = buildTalk();

export function fieldText(field: FieldDoc): string {
  const parts = [field.about];
  if (field.values && field.values.length > 1) parts.push(`One of: ${field.values.join(", ")}.`);
  parts.push(field.optional ? "Optional." : "Required.");
  return parts.join(" ");
}

export function blockDoc(type: string): KindDoc {
  const found = TALK.blocks.find((item) => item.type === type);
  if (!found) throw new Error(`No help for block ${type}.`);
  return found;
}

export function widgetDoc(type: string): KindDoc {
  const found = TALK.widgets.find((item) => item.type === type);
  if (!found) throw new Error(`No help for widget ${type}.`);
  return found;
}

export function deckField(name: string): FieldDoc | null {
  return TALK.deck.find((field) => field.name === name) ?? null;
}

export function slideField(name: string): FieldDoc | null {
  return TALK.slide.find((field) => field.name === name) ?? null;
}
