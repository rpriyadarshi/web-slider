# Web Slider

A browser presenter for YAML slide decks. Open a file, present it, record decisions and notes, then download YAML, PDF, Word, or PowerPoint. Nothing is written back to the original file.

```bash
npm install
npm run dev
```

`npm test` checks the deck schema, navigation, PowerPoint import, and the exporters. `npm run build` produces the static site.

## Open a deck

The start screen and the Open icon take a `.yaml` or `.yml` file, a `.zip` package, or a `.pptx` file. You can also drop a file onto the window.

Opening a file replaces the deck on screen. This browser keeps that deck, the widget answers, and the notes taken during the talk. Download YAML to keep them. Comments from the original file are not preserved.

A `.zip` package has `deck.yaml` at the root and the files the deck names. Download one from the package icon in Export.

A `.pptx` import keeps each slide's title, bullets, and speaker notes. Pictures, charts, and animations in that file are left out.

## Deck

Colors are `#rrggbb`. Unknown keys and illegal values are rejected, and the deck is not shown. Omitted theme fields use the built-in defaults after the file validates.

```yaml
id: launch-review
title: Launch Review
author: Northwind
footer: Launch Review
showSlideNumber: true
aspect: "16:9"
brand:
  name: Emporion AI
  wordmark: EMPORION
  tail: AI
  accent: "#3DB892"
  highlight: "#E4B84A"
  mark: brand/mark.svg
  markDark: brand/mark-dark.svg
theme:
  background: "#14181f"
  surface: "#222b3a"
  text: "#f4f1ea"
  muted: "#b4b0a6"
  accent: "#e2a354"
  highlight: "#E4B84A"
  fontHeading: Source Serif 4
  fontBody: Inter
  fontMono: JetBrains Mono
  align: left
  headingScale: 1
  radius: 16
  type:
    title: 58
    section: 52
    slide: 36
    body: 22
    sub: 20
    author: 16
    table: 18
    footer: 14
    wordmark: 12
    mark: 22
    caption: 18
  chrome: dark
slides:
  - id: scope
    title: Scope is the constraint
    layout: content
    notes: Speaker script.
    blocks:
      - type: bullets
        items:
          - text: First point
            step: 1
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
```

`brand: emporion` uses the built-in Court mark. A custom brand is a mapping with `name`, `wordmark`, optional `tail`, `accent`, `highlight`, `mark`, and optional `markDark`. A mark is an `https` URL, a `data` URI, or a path inside a zip package. Dark slide backgrounds use `markDark` when it is set.

The lockup — mark plus wordmark, with the tail in the highlight color — is drawn in the footer of every slide. The audience window shows that slide, so it shows the lockup. The same lockup sits in the presenter toolbar. `theme.type.mark` is the mark size in px, and `theme.type.wordmark` is the wordmark size. Those sizes are the same on every slide.

`footer` is the line beside the lockup. `showSlideNumber` defaults to on. `aspect` is `16:9` or `4:3` and sets the stage and the PDF page.

`theme.type` is the rest of the slide type, in px: `title`, `section`, `slide`, `body`, `sub`, `author`, `table`, `footer`, and `caption`. Omit a key and the default above is used. `headingScale` (up to 3) multiplies `title`, `section`, and `slide`. The slide and the exports use these sizes. The toolbar, panes, and buttons are the app shell. They are not in the deck.

`theme.chrome` is `light` or `dark`. `chromeLight` and `chromeDark` set the shell colors `ground`, `paper`, `text`, `muted`, and `line`. Built-in fonts are Inter, Source Serif 4, and JetBrains Mono. Any other family needs a `fonts` entry whose files are data URIs or paths in the package.

A slide with `hidden: true` stays in the outline and overview, dimmed, and a click still opens it. Arrow keys skip it, and every export leaves it out. `autoAdvance` is a number of seconds, at most 3600. The slide moves on only after its last build, and not while the audience screen is blank.

Layouts are `title`, `section`, `content`, and `quote`. A slide may override `background`, `surface`, `text`, `muted`, and `accent`.

### Blocks

Use these on `blocks` and `side`. A `step` hides the block, or a list item, until you advance to it.

- `paragraph`: `text`
- `bullets` and `numbered`: `items` of `{ text, step? }`
- `table`: `headers` and `rows` of strings, one cell per header
- `chart`: `kind` is `bar` or `column`, plus `labels` and the same number of `values` (at most 12)
- `link`: `text`, plus either an `https` `href` or a `slide` id
- `video`: an `https` `src` and an optional `title`
- `quote`: `text`, optional `attribution`
- `code`: `code`, optional `language`
- `image`: `src`, optional `alt`. `src` is `https`, a `data` URI, or a package path
- `callout`: `text`
- `divider`

### Widgets

Widgets are `radio`, `checkbox`, `select`, `text`, and `scale` (1–5). `radio`, `checkbox`, and `select` need at least two `options`. In an embedded deck the bottom row is the feedback form.

## Editor

The YAML pane beside the slide is the deck file. This is a structured editor for that file, not a free-form canvas. There is one document.

Typing in the pane updates the slide when the YAML parses. When it does not parse, the error stays in the pane and the last valid slide stays on screen. Click a title, list item, block, widget, footer, or the lockup to select that node in the YAML, the way Chrome's element inspector selects a node. Move the caret in the YAML and the matching part of the slide is marked; if the caret is in another slide, the view jumps there. Double-click a title or list item to edit it, which writes the text back into the same YAML. Notes taken during the talk, and widget answers, are written into that YAML as `takenNotes` and `answer` while you record them. A click rewrites the pane through the serializer, so comments in the pane are dropped at that moment, the same as a download. Download writes that YAML, with the widget answers and the notes taken during the talk merged in. There is no second save format.

## Presenting

Arrow keys, space, and page up or down move through builds and then slides, skipping hidden slides. Type a visible slide number and press Enter to jump. Home and End jump to the ends. `O` opens the overview. `F` toggles full screen.

`B` blanks the audience window in black and `W` blanks it in white. Any other navigation key clears the blank and does not move. `L` toggles a laser pointer on the slide and sends it to the audience window. `C` toggles live captions from the microphone. If this browser has no speech recognition, or the microphone is blocked, captions stop and say why. Laser and captions are presenter controls. They are not deck fields.

The notes band shows a preview of the next visible slide. An audience icon opens a second window that follows this one: the slide, the build, the blank color, the laser, and the caption. That window does not show notes or widgets. The toolbar shows the clock beside the elapsed timer, and a restart icon resets the timer.

Chrome controls are icons. The name is the tooltip. A theme icon switches the shell between light and dark. Export and examples open from icons and close with Escape. The outline and the examples pane each have a pin and a close button. The notes band collapses. The slide does not.

## Embed

Host the built site, then on the customer page:

```html
<div id="deck"></div>
<script src="https://your-slider.example/embed.js"></script>
<script>
  WebSlider.embed("#deck", {
    src: "/presentations/launch.yaml",
    onFeedback(report) {
      console.log(report.deckId, report.slideId, report.answers, report.notes);
    },
  });
</script>
```

`src` may be a `.yaml` file or a `.zip` package. The iframe shows the slides, the lockup, and the bottom feedback row. Widget answers and notes are posted to the host as `web-slider:feedback`. A page can also iframe `/?embed=1&deck=` with an absolute deck URL, or post `{ type: "web-slider:load", yaml }` or `{ type: "web-slider:load", zip }` into the frame.

## Generate a deck

Give an AI assistant [prompts/generate-deck.md](prompts/generate-deck.md). It is the contract for a YAML deck or a zip package.

## Exports

PDF embeds Inter, Source Serif 4, and JetBrains Mono, uses `theme.type` for the type, and uses the deck aspect for the page size. Word and PowerPoint name those fonts and the same sizes, but cannot embed the fonts from the browser, so a machine without them installed will substitute. The lockup is included. An SVG mark is drawn in the browser export. Code is syntax-colored in the live view and plain monospace in the files.

Hidden slides are left out. A chart is drawn in the live view and in the PDF. Word and PowerPoint write its labels and values as text. A video plays in the live view. The exports keep its title and `https` address. Images in the files must be PNG or JPEG.

The handout icon writes a Word file where each visible slide is followed by its script, widget prompts with the recorded answers, and the notes taken on that slide.
