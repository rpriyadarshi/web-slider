# Generate a Web Slider presentation

You are the author. You write one talk: slides, the speaker script, and the questions. You write that file where the user told you to write it.

If the user is in another workspace, the file goes in the directory they named. You do not create it under `samples/` in the Web Slider repository, and you do not edit that repository to hold it. If they did not name a directory, ask. Do not guess another workspace's directories. `samples/` is the shipped product examples. It is not a default output folder. [AGENTS.md](../AGENTS.md) is the rule.

If the request is a theme, a brand, a config, or a manifest, stop and follow [admin-theme.md](admin-theme.md). The routing for a change to this repository's own samples is [docs/agents.md](../docs/agents.md). The human story is [docs/make-slides.md](../docs/make-slides.md).

Do not invent keys. If a value is illegal, the presenter rejects the file and does not show the deck. The enforced schema is `deckSchema` in `src/model/schema.ts`.

## What you write

One talk file. That file is the YAML pane beside the slide. A free-form canvas is out of scope: if a change cannot be written as legal YAML, it is not part of the deck.

You do not write:

- `embed.js`, or anything under `public/`. That directory is the served app.
- `web-slider.config.yaml`. The config only names a manifest. The person who boots the app supplies it with `--config`, `?config=`, or the boot screen.
- `manifest.yaml`, marks, or font files. Those are the admin theme. In this repository they ship under `samples/themes/` or `samples/examples/<name>/`. A talk you were asked to write elsewhere does not get a new folder in either place.
- `manifest.resolved.json`. That is a system cache. People do not edit it.
- `takenNotes` on a slide, or `answer` on a widget, in a new deck. Those are the presenter session. The browser keeps them until a download or a handout merges them.

A talk does not carry brand, theme, or fonts. `samples/examples/launch-review.yaml` is one of the shipped samples. It is not a template path for the next deck you are asked to write. A theme or a catalog entry is a different file, and a catalog entry exists only when the user told you to change the shipped samples. Follow [admin-theme.md](admin-theme.md) for that file, and leave those keys out of the talk.

## Roles

- **System.** Schema, layouts, block and widget types, default type scale, presenter behavior. Software. You do not edit it.
- **Admin theme.** Brand, chrome, type scale, marks, and fonts. The loaded manifest supplies them. A name with no slash is a package name: `manifest: emporion` and `brand: emporion` both load `samples/themes/emporion/manifest.yaml`. `brand` as a name uses that package's brand object (`name`, `wordmark`, optional `tail`, `accent`, `highlight`, `mark`, optional `markDark`).
- **Author deck.** The file you write.
- **Presenter session.** Answers and taken notes. Leave them out of a new deck.

Boot order is the base install, then a config names a manifest, then someone opens the deck YAML. If the config is missing, or a manifest, brand reference, or mark file is missing, the presenter shows the error and does not substitute another theme.

The lockup is the mark plus the wordmark. The presenter draws it in the footer of every slide, including the audience window, and in PDF, Word, and PowerPoint, from the loaded theme. Do not add an image block that repeats the logo. Do not put type sizes, chrome, or a brand on a slide or on the deck.

Laser, captions, the blank screen, and the audience window are presenter controls. They are not YAML.

Clicking a part of the slide, including a widget, selects the matching YAML node, and the caret in the YAML marks the matching part of the slide. A read-only session block in that pane shows notes and answers recorded during the talk. Those stay in the browser until export.

## Output

Before you finish, from this repository:

```bash
npm run pack -- --deck /absolute/path/to/talk.yaml
```

That command is the presenter's check (`npm run pack`, `src/package/packTalk.ts`). It parses the talk with `deckSchema`. It writes a zip only when an `image.src` is a package path, and only after those files are PNG or JPEG files beside the talk. It writes nothing when every image is an `https://` URL or a `data:` URI. It prints every problem and writes nothing when the talk fails. The talk is finished when the command exits 0. Open the zip it names, or the YAML when it says no zip was written. Do not write a zip script of your own.

You do not write or boot the theme. If the room has no theme yet, stop and follow [admin-theme.md](admin-theme.md).

### Diagrams (Mermaid and the like)

Prefer native Mermaid. If the diagram can be expressed in Mermaid, write `type: mermaid` with `source` in the talk. Do not use `type: code` with `language: mermaid`. Do not pre-render Mermaid to PNG with `mmdc` and an `image` block unless the user asked for a static raster, or Mermaid cannot draw that diagram.

```yaml
- type: mermaid
  source: |
    flowchart LR
      A --> B
  caption: Optional label
```

The presenter draws it. PDF, Word, and PowerPoint rasterize it. Pack does not need a PNG for that block.

For other diagram tools only (or a static raster the user asked for):

1. Write sources beside the talk (`diagrams/*.mmd` or similar).
2. Render to PNG or JPEG (`mmdc` from `@mermaid-js/mermaid-cli` is fine; set `MMDC_PUPPETEER_CONFIG` when headless Chrome needs an executable path).
3. Reference them as package paths on `image` blocks, for example `src: diagrams/architecture.png`.
4. Run `npm run pack` on the talk. That packs the files. A bare YAML file cannot resolve package paths.

## Deck

```yaml
id: launch-review          # letters, numbers, _ - ; starts with a letter or number
title: Launch Review
author: Northwind          # optional
footer: Launch Review      # optional line beside the lockup
# showSlideNumber and aspect come from the manifest.
# Set them here only when this talk differs.
# aspect is "16:9" or "4:3". showSlideNumber is true or false.
slides:
  - id: intro
    title: Welcome
    layout: title          # title, section, content, quote
    subtitle: Optional
    notes: Speaker script, shown read-only.
    hidden: false          # true keeps the slide in the outline but out of the talk and exports
    autoAdvance: 8         # optional seconds after the last build; omit so the talk stays manual
    theme:                 # optional colors only
      background: "#1b2430"
    blocks: []
    side: []               # side column
    widgets: []            # feedback row
```

Every object is strict. An unknown key rejects the file. Slide ids are unique in the deck. Widget ids are unique on that slide. At least one slide.

The manifest, which you do not write, supplies the brand, the type scale, chrome, the default aspect, and fonts. Built-in faces are Inter, Source Serif 4, and JetBrains Mono. The package's `fonts` map names the files. The shipped files are in `samples/themes/emporion/fonts/`. A font family that is not built in needs a `fonts` entry with a `regular` file on the manifest. That is an admin file, not the deck.

Colors are `#rrggbb`. A slide `theme` may set only `background`, `surface`, `text`, `muted`, and `accent`.

`autoAdvance` is greater than 0 and at most 3600. It starts only after the last build on that slide. Omit it unless the deck is a kiosk.

## Blocks

Use these on `blocks` and `side`. `step` is a non-negative integer. It hides the block, or a list item, until the presenter advances. Omit `step` to show it immediately.

- `paragraph`: `text` (non-empty)
- `bullets`: `items` of `{ text, step? }`, at least one item
- `numbered`: same item shape as bullets
- `table`: `headers` (list of non-empty strings) and `rows` (list of string lists). Each row has one cell per header.
- `chart`: `kind` (`bar` or `column`), `labels`, and `values` (one finite number per label, at least one, at most 12). The live view and the PDF draw the bars. Word and PowerPoint write the labels and values as text.
- `mermaid`: `source` (non-empty Mermaid text), optional `caption`. The live view draws the diagram. PDF, Word, and PowerPoint rasterize it to PNG in the browser. Pack does not need a separate image file.
- `link`: `text`, plus either `href` (`https://...`) or `slide` (a slide id in this deck). Exactly one of those.
- `video`: `src` (`https://...` only), optional `title`. It plays in the presenter. Exports keep the title and the address.
- `quote`: `text`, optional `attribution`
- `code`: `code`, optional `language`. Omit `language` for plain text. The live view highlights `bash`, `css`, `html`, `javascript`, `json`, `jsx`, `markdown`, `python`, `tsx`, `typescript`, and `yaml`. Any other name fails when the slide is shown. Exports use plain monospace.
- `image`: `src`, optional `alt`. `src` is `https://`, a `data:` URI, or a package path with no `..` and no leading `/`. Exports accept PNG and JPEG only.
- `callout`: `text`
- `divider`

## Feedback widgets

Put questions the audience should answer on `widgets`. In an embedded presentation these are the feedback form.

- `radio` and `select`: `id`, `prompt`, `options` (at least two non-empty strings). A stored `answer` must be one of the options.
- `checkbox`: same shape. A stored `answer` is a list of options.
- `text`: `id`, `prompt`. A stored `answer` is a string.
- `scale`: `id`, `prompt`. A stored `answer` is an integer from 1 to 5. Do not add `options`.

Keep prompts short. One decision per slide is enough. Use `notes` for the speaker script, not for the question. Omit `answer` when you are writing a new deck. Put `answer` on a widget only when you are saving a session that was already recorded.

## Shape

Five to twelve slides. Open with `layout: title`, use `section` as a break, and put the ask on a `content` slide with a widget. Side content is a short reference or a short code block, not a second essay. One chart or one video is enough.

## Check

Before you finish, confirm:

- The file is a talk. It has no `brand`, `theme`, or `fonts` at the deck root, and no type sizes, chrome, or fonts on a slide.
- You did not emit a config, a manifest, a mark, a font, or `embed.js`. Those are the admin seat.
- Every id is unique where the schema requires it, and matches letters, numbers, hyphens, and underscores.
- Every color matches `#rrggbb`.
- `npm run pack -- --deck` on this talk exited 0. You did not write a zip script of your own.
- When pack prints a package path, that zip is what you open. When it says no zip was written, the YAML is what you open.
- Diagrams that Mermaid can draw use `type: mermaid` with `source`. You did not pre-render those to PNG. Other diagram tools use PNG or JPEG on `image` blocks.
- Every video src and every link href is `https://`.
- Every link has either an href or a slide id, not both, and the slide id exists.
- Every chart has one value per label, and every table row has one cell per header.
- A code `language`, if set, is one of the names the live view highlights.
- `takenNotes` and `answer` are absent on a new deck.
