# Generate a Web Slider presentation

You write a presentation as YAML for Web Slider. The file is the whole deck: colors, type, chrome theme, brand, slides, side examples, and the feedback widgets at the bottom. Do not invent keys. If a value is illegal, the presenter rejects the file.

## Output

Prefer one self-contained `.yaml` file. Put marks and images inline as `data:` URIs or `https://` URLs.

When the deck needs font files or several images, also produce a zip package:

- `deck.yaml` at the root
- other files at the relative paths named in the YAML, such as `brand/mark.svg` or `fonts/BrandSerif-Regular.ttf`
- no `..` path segments

## Deck

```yaml
id: launch-review          # letters, numbers, _ -
title: Launch Review
author: Northwind          # optional
footer: Launch Review      # optional line on every slide
showSlideNumber: true      # omit to show numbers; false hides them
aspect: "16:9"             # 16:9 or 4:3
brand: emporion            # shorthand for the Emporion Court mark
# or spell the brand out:
# brand:
#   name: Northwind
#   wordmark: NORTHWIND
#   tail: AI              # optional second word, drawn in highlight
#   accent: "#3DB892"
#   highlight: "#E4B84A"
#   mark: brand/mark.svg  # https, data URI, or package path
#   markDark: brand/mark-dark.svg
theme:
  background: "#14181f"   # slide card
  surface: "#222b3a"
  text: "#f4f1ea"
  muted: "#b4b0a6"
  accent: "#e2a354"
  highlight: "#E4B84A"    # wordmark tail and current outline item
  fontHeading: Source Serif 4
  fontBody: Inter
  fontMono: JetBrains Mono
  align: left             # left or center
  headingScale: 1         # up to 3
  radius: 16              # up to 48
  chrome: dark            # light or dark presenter shell
  chromeLight:
    ground: "#FAFAFA"
    paper: "#FFFFFF"
    text: "#1F1F1F"
    muted: "#5E5E5E"
    line: "#E0E0E0"
  chromeDark:
    ground: "#121212"
    paper: "#1E1E1E"
    text: "#E8E8E8"
    muted: "#A6A6A6"
    line: "#333333"
fonts:                    # only for faces that are not built in
  Brand Serif:
    regular: fonts/BrandSerif-Regular.ttf
    semibold: fonts/BrandSerif-Semibold.ttf
slides:
  - id: intro
    title: Welcome
    layout: title         # title, section, content, quote
    subtitle: Optional
    notes: Speaker script, shown read-only.
    hidden: false          # true keeps the slide in the outline but out of the talk and exports
    autoAdvance: 8         # optional seconds after the last build; omit so the talk stays manual
    blocks: []
    side: []              # examples column
    widgets: []           # feedback row
```

Built-in fonts, which need no `fonts` entry: Inter, Source Serif 4, JetBrains Mono. Any other family must have a `fonts` entry.

Colors are `#rrggbb`. A slide may override `background`, `surface`, `text`, `muted`, and `accent` with its own `theme`.

## Blocks

Use these on `blocks` and `side`. `step` hides the block until the presenter advances. Omit `step` to show it immediately.

- `paragraph`: `text`
- `bullets`: `items` of `{ text, step? }`
- `numbered`: same item shape as bullets
- `table`: `headers` (list of strings) and `rows` (list of string lists, one cell per header)
- `link`: `text`, plus either `href` (`https://...`) or `slide` (an existing slide id)
- `chart`: `kind` (`bar` or `column`), `labels`, and `values` (one finite number per label, at most 12)
- `video`: `src` (`https://...` only), optional `title`
- `quote`: `text`, optional `attribution`
- `code`: `code`, optional `language` (`yaml`, `typescript`, `javascript`, `python`, `json`, `bash`, `css`, `html`, `markdown`)
- `image`: `src`, optional `alt`. `src` is `https://`, a `data:` URI, or a package path.
- `callout`: `text`
- `divider`

## Feedback widgets

Put questions the audience should answer on `widgets`. In an embedded presentation these are the feedback form.

- `radio` and `select`: `id`, `prompt`, `options` (at least two)
- `checkbox`: same, the answer is a list
- `text`: `id`, `prompt`
- `scale`: `id`, `prompt` (1–5, no options)

Keep prompts short. One decision per slide is enough. Use `notes` for the speaker script, not for the question.

## Shape

Five to twelve slides. Open with `layout: title`, use `section` as a break, and put the ask on a `content` slide with a widget. Side content is an example or a short code block, not a second essay.

## Check

Before you finish, confirm every id is unique, every color matches `#rrggbb`, every image src is https, data, or a package path that exists in the zip, and you added no keys outside this contract.
