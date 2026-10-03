# Generate a Web Slider presentation

You write a presentation as YAML for Web Slider. You write the author deck: slides, scripts, and widget prompts. Do not invent keys. If a value is illegal, the presenter rejects the file.

## Roles

Web Slider has four roles. You write only the author deck.

- **System.** The schema, the layouts, the block and widget types, the default type scale, and presenter behavior. This is in the software. A customer does not edit a file to change it.
- **Admin theme.** Brand, chrome, the type scale, marks, and fonts. That package is `manifest.yaml`, named by the install's `web-slider.config.yaml`. The presenter draws the lockup and the type scale from the loaded manifest. `themes/` holds built-in product themes. Only `themes/emporion/` ships. `examples/northwind` is a sample admin, not a second product theme. A name with no slash is a package name: `manifest: emporion` and `brand: emporion` both load `themes/emporion/manifest.yaml`. `brand` as a name uses the brand object in that package (`wordmark`, `tail`, colors, and mark paths). Do not copy them into the deck.
- **Author deck.** Slides, scripts, and widget prompts. This is the file you write, and it is the YAML pane. A slide may override `background`, `surface`, `text`, `muted`, and `accent`. Do not put `brand`, `theme`, or `fonts` on the deck.
- **Presenter session.** Answers and taken notes. The browser keeps them until a download or a handout merges them. Leave `takenNotes` and `answer` out of a new deck.

Boot order is the base install, then a config names a `manifest.yaml` (or a package name such as `emporion`, which loads `themes/emporion/manifest.yaml`), then the user opens a deck YAML. Precedence for that config is the `--config` flag, then the `config` query parameter, then the boot screen asks. The presenter does not load a theme when no config was given. If the config names a missing manifest, or a package, a brand reference, or a mark file is missing, the presenter shows the error and does not substitute another theme. YAML is for files a person or an AI writes. JSON is for artifacts only the system writes, such as a resolved theme cache and the session. Do not generate `web-slider.config.yaml`, `manifest.yaml`, or `manifest.resolved.json`. `themes/` holds built-in product themes (only emporion ships). `examples/northwind` is a sample admin, not a second product theme. `examples/launch-review.yaml` is a sample talk. It does not carry brand, theme, or fonts.

Laser, captions, the blank screen, and the audience window are presenter controls. They are not YAML.

The presenter also has a YAML pane beside the slide. That pane is the author deck, not a second design surface. A free-form canvas is out of scope: if a change cannot be written as legal YAML, the editor does not offer it. The AI path and the pane edit the same file. Clicking a part of the slide, including a widget, selects the matching YAML node, and the caret in the YAML marks the matching part of the slide. A read-only session block in that pane shows the notes and answers recorded during the talk. Those stay in the browser until export. They are not written into the deck YAML while someone is presenting.

## Output

Prefer one self-contained `.yaml` file. Put slide images inline as `data:` URIs or `https://` URLs. Marks and extra fonts belong to the manifest, not this file.

When the deck needs several images, also produce a zip package:

- `deck.yaml` at the root
- image files at the relative paths named in the YAML
- no `..` path segments
- no copy of the manifest, the mark, or the font files

## Deck

```yaml
id: launch-review          # letters, numbers, _ -
title: Launch Review
author: Northwind          # optional
footer: Launch Review      # optional line beside the lockup
# showSlideNumber and aspect come from the manifest.
# Set them here only when this talk differs.
slides:
  - id: intro
    title: Welcome
    layout: title         # title, section, content, quote
    subtitle: Optional
    notes: Speaker script, shown read-only.
    hidden: false         # true keeps the slide in the outline but out of the talk and exports
    autoAdvance: 8        # optional seconds after the last build; omit so the talk stays manual
    blocks: []
    side: []              # examples column
    widgets: []           # feedback row
```

The manifest, which you do not write, supplies the brand, the type scale, chrome, the default aspect, and fonts. Built-in faces are Inter, Source Serif 4, and JetBrains Mono. The package's `fonts` map names the files; the shipped files are in `themes/emporion/fonts/`. `brand: emporion` on a manifest uses the brand object in `themes/emporion/manifest.yaml`, including `mark.svg` and `mark-on-dark.svg` beside that file. A brand written in place names `mark` and optional `markDark` as `https` URLs, `data` URIs, or paths beside the manifest that declares them.

Colors are `#rrggbb`. A slide may override `background`, `surface`, `text`, `muted`, and `accent` with its own `theme`. Do not put type sizes, chrome, or a brand on a slide or on the deck.

The lockup is the mark plus the wordmark. The presenter draws it in the footer of every slide, including the audience window, and in PDF, Word, and PowerPoint, from the loaded theme. Do not add an image block that repeats the logo.

`autoAdvance` is at most 3600. It starts only after the last build on that slide.

## Blocks

Use these on `blocks` and `side`. `step` hides the block until the presenter advances. Omit `step` to show it immediately.

- `paragraph`: `text`
- `bullets`: `items` of `{ text, step? }`
- `numbered`: same item shape as bullets
- `table`: `headers` (list of strings) and `rows` (list of string lists, one cell per header)
- `chart`: `kind` (`bar` or `column`), `labels`, and `values` (one finite number per label, at most 12). The live view and the PDF draw the bars. Word and PowerPoint write the labels and values as text.
- `link`: `text`, plus either `href` (`https://...`) or `slide` (an existing slide id). Exactly one of those.
- `video`: `src` (`https://...` only), optional `title`. It plays in the presenter. Exports keep the title and the address.
- `quote`: `text`, optional `attribution`
- `code`: `code`, optional `language` (`yaml`, `typescript`, `javascript`, `python`, `json`, `bash`, `css`, `html`, `markdown`)
- `image`: `src`, optional `alt`. `src` is `https://`, a `data:` URI, or a package path. Exports accept PNG and JPEG only.
- `callout`: `text`
- `divider`

## Feedback widgets

Put questions the audience should answer on `widgets`. In an embedded presentation these are the feedback form.

- `radio` and `select`: `id`, `prompt`, `options` (at least two)
- `checkbox`: same, the answer is a list
- `text`: `id`, `prompt`
- `scale`: `id`, `prompt` (1–5, no options)

Keep prompts short. One decision per slide is enough. Use `notes` for the speaker script, not for the question. Recorded answers belong on the widget as `answer` only when you are saving a session, not when you are writing a new deck.

## Shape

Five to twelve slides. Open with `layout: title`, use `section` as a break, and put the ask on a `content` slide with a widget. Side content is an example or a short code block, not a second essay. One chart or one video is enough. Do not auto-play the talk unless the deck is a kiosk: omit `autoAdvance` on a talk a person gives.

## Check

Before you finish, confirm every id is unique, every color matches `#rrggbb`, every image src is https, data, or a package path that exists in the zip, every video src is `https://`, every chart has one value per label, every link has either an href or a slide id, and you added no keys outside this contract.
