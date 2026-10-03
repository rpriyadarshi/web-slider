# Generate a Web Slider presentation

You write a presentation as YAML for Web Slider. You write the author deck: slides, scripts, and widget prompts. Do not invent keys. If a value is illegal, the presenter rejects the file and does not show the deck.

## What you write

One talk file. That file is the YAML pane beside the slide. A free-form canvas is out of scope: if a change cannot be written as legal YAML, it is not part of the deck.

You do not write:

- `embed.js`, or anything under `public/`. That directory is the served app.
- `web-slider.config.yaml`. The config only names a manifest. The person who boots the app supplies it with `--config`, `?config=`, or the boot screen.
- `manifest.yaml`, marks, or font files. Those are the admin theme. They live under `samples/themes/` for a product theme, or under `samples/examples/<name>/` for a sample admin.
- `manifest.resolved.json`. That is a system cache. People do not edit it.
- `takenNotes` on a slide, or `answer` on a widget, in a new deck. Those are the presenter session. The browser keeps them until a download or a handout merges them.

`samples/themes/emporion/` is a product theme: the Court mark, the fonts, and the default type scale. Harbor, Ledger, and Meridian are further product themes in that same directory. They name the font files under `samples/themes/emporion/fonts/` and do not copy them. `samples/examples/northwind/` is one sample admin that sets `brand: emporion` and its own slide colors. `samples/examples/launch-review.yaml` is a sample talk, and Harbor, Ledger, and Meridian each have a talk beside their config. A talk does not carry brand, theme, or fonts. Follow that split if you are asked to add another example: one folder under `samples/examples/<name>/` with a config, a manifest only when that example has its own colors, and the talk in that same folder. Add the config and the talk to `samples/catalog.yaml`. Do not put a sample admin under `samples/themes/`.

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

Prefer one `.yaml` file. Put slide images inline as `data:` URIs or `https://` URLs.

When the deck needs several images, also produce a zip package:

- `deck.yaml` at the root
- image files at the relative paths named in the YAML
- no `..` path segments and no path that starts with `/`
- no copy of the manifest, the mark, or the font files

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
- You did not emit a config, a manifest, a mark, a font, or `embed.js`.
- Every id is unique where the schema requires it, and matches letters, numbers, hyphens, and underscores.
- Every color matches `#rrggbb`.
- Every image src is https, data, or a package path that exists in the zip.
- Every video src and every link href is `https://`.
- Every link has either an href or a slide id, not both, and the slide id exists.
- Every chart has one value per label, and every table row has one cell per header.
- A code `language`, if set, is one of the names the live view highlights.
- `takenNotes` and `answer` are absent on a new deck.
