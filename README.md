# Web Slider

A browser presenter for YAML slide decks. Open a file, present it, record decisions and notes, then download YAML, PDF, Word, or PowerPoint. Nothing is written back to the original file.

```bash
npm install
npm run dev
```

`npm test` checks the deck schema, navigation, PowerPoint import, and the exporters. `npm run build` produces the static site.

## Roles

Four roles. The talk file is only one of them.

**System.** The schema, the layouts, the block and widget types, the default type scale, and presenter behavior. This is in the software. A customer does not edit a file to change it.

**Admin theme.** Brand, chrome, the type scale, marks, and fonts. This is `manifest.yaml`, the file named by the config. Asset files stay SVG, TTF, PNG, or JPEG next to that manifest. The built-in package is `themes/emporion/`: `manifest.yaml`, `mark.svg`, `mark-on-dark.svg`, `favicon.svg`, and the font files in `fonts/`. A config or brand value with no slash is a package name, so `manifest: emporion` and `brand: emporion` both mean `themes/emporion/manifest.yaml`. The same rule applies to any other package name. `brand` as a name uses the brand object in that package. A missing package, a brand cycle, or a missing mark stops the app. The deck does not copy this package.

**Author deck.** Slides, scripts, and widget prompts. This is the YAML pane. An AI generates this file. A slide may override a color. The deck does not restate the mark or the type scale. The shipped example is `examples/launch-review.yaml`.

**Presenter session.** Answers and taken notes. They stay in the browser for this run. Export and the handout merge them into the downloaded file.

## Boot order

1. The base install is the app, the schema, the theme packages under `themes/`, and the presenter. Font files ship in `themes/emporion/fonts/` and are named by that package's manifest.
2. `web-slider.config.yaml` at the site root points at a manifest. `manifest: themes/northwind/manifest.yaml` is a site-root path. A name with no slash, such as `manifest: emporion`, loads `themes/<name>/manifest.yaml`. If that config file is missing, the install loads the package named `emporion` through that same rule. If the config names a missing manifest, a package or one of its mark or font files is missing, a brand name cycles, or the YAML is invalid, the app stops and shows the error. It does not substitute another brand.
3. The user opens a deck YAML. Open loads only the talk file, on top of the theme already loaded.

YAML is for files a person or an AI writes: the config, the manifest, and the deck. JSON is for artifacts only the system writes: an optional `manifest.resolved.json` cache beside the manifest, and the session. People do not edit those JSON files. This presenter resolves the manifest in memory. If `manifest.resolved.json` is present and its hash matches the manifest, it must agree with that resolution. A stale hash is ignored and the manifest is resolved again. This browser build does not write the cache file, because it cannot update the install directory.

## Open a deck

The start screen and the Open icon take a `.yaml` or `.yml` file, a `.zip` package, or a `.pptx` file. You can also drop a file onto the window. Load example fetches `examples/launch-review.yaml`. That file is an author talk. It does not carry brand, theme, or fonts.

Opening a file replaces the deck on screen. This browser keeps that deck, the widget answers, and the notes taken during the talk. Download YAML to keep the answers and the notes. That download merges them into a new file, and comments from the original file are not copied into it.

A `.zip` package has `deck.yaml` at the root and the files the deck names. Download one from the package icon in Export.

A `.pptx` import keeps each slide's title, bullets, and speaker notes. Pictures, charts, and animations in that file are left out.

## Theme

`web-slider.config.yaml` names the manifest. The shipped install points at `themes/northwind/manifest.yaml`. `manifest: emporion` is a package name and loads `themes/emporion/manifest.yaml`. A missing config file loads that same package name through the same rule. A config that points at a file that is not there is an error. A missing mark or font file is an error, and the app does not substitute another brand.

The manifest holds `brand`, `theme` (colors, type scale, chrome), optional `fonts`, the default `aspect`, and `showSlideNumber`. A `brand` value that is a package name, such as `brand: emporion`, loads `themes/<name>/manifest.yaml` and uses that file's brand object: `name`, `wordmark`, optional `tail`, `accent`, `highlight`, `mark`, and optional `markDark`. A brand written in place is that same mapping. A mark or font file is an `https` URL, a `data` URI, or a path relative to the manifest that declares it, such as `mark.svg` or `fonts/Inter-Regular.ttf`. Those files stay SVG, TTF, PNG, or JPEG. Omitted theme fields use the built-in defaults after the manifest validates. Unknown keys are rejected and the theme is not loaded.

The lockup — mark plus wordmark, with the tail in the highlight color — is drawn in the footer of every slide from the loaded theme. The audience window shows that slide, so it shows the lockup. The same lockup sits in the presenter toolbar. `theme.type.mark` is the mark size in px, and `theme.type.wordmark` is the wordmark size. Those sizes are the same on every slide.

`theme.type` is the rest of the slide type, in px: `title`, `section`, `slide`, `body`, `sub`, `author`, `table`, `footer`, and `caption`. `headingScale` (up to 3) multiplies `title`, `section`, and `slide`. The slide and the exports use these sizes. The toolbar, panes, and buttons are the app shell. They are not in the deck.

`theme.chrome` is `light` or `dark`. `chromeLight` and `chromeDark` set the shell colors `ground`, `paper`, `text`, `muted`, and `line`. Built-in font names are Inter, Source Serif 4, and JetBrains Mono. The package's `fonts` map names the files. The shipped files are in `themes/emporion/fonts/`. Any other family needs a `fonts` entry on the manifest.

## Deck

Colors are `#rrggbb`. Unknown keys and illegal values are rejected, and the deck is not shown. `brand`, `theme`, and `fonts` on the deck are rejected: they belong to the manifest. A slide may still override `background`, `surface`, `text`, `muted`, and `accent`.

```yaml
id: launch-review
title: Launch Review
author: Northwind
footer: Launch Review
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

`footer` is the line beside the lockup. The manifest's `showSlideNumber` defaults to on; a deck may set `showSlideNumber: false`. The manifest's `aspect` is `16:9` or `4:3` and sets the stage and the PDF page; a deck may set its own `aspect`.

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

The YAML pane beside the slide is the author deck. It is a syntax-highlighted YAML editor, not a free-form canvas. The editable document is that deck. A read-only session block in the same pane shows the current slide's taken notes and widget answers, labeled as the session. That block is the presenter session. It is not the deck file.

Typing in the pane updates the slide when the YAML parses. When it does not parse, the error stays in the pane and the last valid slide stays on screen. Click a title, list item, block, widget, or footer to select that node in the author YAML, the way Chrome's element inspector selects a node. The lockup comes from the loaded theme, so it is not a node in the deck file. Clicking a widget selects `slides/N/widgets/M` in the author YAML. Move the caret in the YAML and the matching part of the slide is marked; if the caret is in another slide, the view jumps there. Double-click a title or list item to edit it. That writes the text back into the author YAML through the serializer, and comments in the pane are dropped at that moment. Focusing the taken-notes field points at the session block. Notes taken during the talk, and widget answers, stay in the session. They are not written into the deck YAML while you record them. Download YAML and the handout merge those answers and notes into the exported file. Opening that download restores them into the session, and the YAML pane shows the keys because they are in that file.

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

PDF embeds Inter, Source Serif 4, and JetBrains Mono, uses the loaded theme's type sizes, and uses the aspect for the page size. Word and PowerPoint name those fonts and the same sizes, but cannot embed the fonts from the browser, so a machine without them installed will substitute. The lockup is included. An SVG mark is drawn in the browser export. Code is syntax-colored in the live view and plain monospace in the files.

Hidden slides are left out. A chart is drawn in the live view and in the PDF. Word and PowerPoint write its labels and values as text. A video plays in the live view. The exports keep its title and `https` address. Images in the files must be PNG or JPEG.

The handout icon writes a Word file where each visible slide is followed by its script, widget prompts with the recorded answers, and the notes taken on that slide.
