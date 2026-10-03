# Web Slider

A browser presenter for YAML slide decks. Open a talk, present it, record decisions and notes, then download YAML, PDF, Word, or PowerPoint. Nothing is written back to the original file.

```bash
npm install
npm run dev -- --config samples/examples/northwind/web-slider.config.yaml
```

`npm test` checks the deck schema, navigation, PowerPoint import, and the exporters. `npm run build` produces the static site and copies `samples/` into `dist/samples/`. `npm run dev` and `npm run preview` take the same `--config` flag.

## Where files live

`public/` is the site. It holds `embed.js`, the script a host page loads. An admin does not write that file, and neither does the person giving the talk. The built page is served from here too.

`samples/` is the install, at the repo root. The dev server, preview, and the production build expose it at `/samples/` so the browser can fetch a config, a theme, and a talk. Those files are not part of the page.

```
public/
  embed.js
samples/
  catalog.yaml                # the installs and talks the boot and start screens list
  themes/
    emporion/                 # product theme; also holds the built-in font files
    harbor/
    ledger/
    meridian/
  examples/
    emporion/                 # config for the Emporion theme, no color overlay
    northwind/                # one sample admin install
      web-slider.config.yaml
      manifest.yaml
    harbor/                   # config plus the Harbor briefing talk
    ledger/                   # config plus the quarterly close talk
    meridian/                 # config plus the incident review talk
    launch-review.yaml        # the sample talk for the Northwind install
```

`samples/themes/` holds product themes: Emporion, Harbor, Ledger, and Meridian. A sample admin does not go there. Harbor, Ledger, and Meridian name the font files in `samples/themes/emporion/fonts/` so those faces are stored once.

`samples/catalog.yaml` lists the configs and the talks. The boot screen reads `installs`. The start screen reads `examples`. A missing catalog is shown as an error. It is not replaced with a built-in list.

The Northwind talk is `samples/examples/launch-review.yaml`. It carries slides only. Harbor, Ledger, and Meridian each have their own talk in the same folder as their config.

Each further example is a folder under `samples/examples/<name>/`:

- `web-slider.config.yaml` is the file you pass at boot.
- `manifest.yaml` is present when that example has its own colors or chrome. The config points at it. Marks or fonts that belong only to that admin sit in the same folder.
- The talk YAML sits in that same folder.

An example that is only a talk on the built-in theme has no manifest. Its config says `manifest: emporion`.

## Roles

Four roles. The talk file is only one of them.

**System.** The schema, the layouts, the block and widget types, the default type scale, and presenter behavior. This is the software. A customer does not edit a file to change it.

**Admin theme.** Brand, chrome, the type scale, marks, and fonts. This is `manifest.yaml`, the file named by the config. Asset files stay SVG, TTF, PNG, or JPEG next to that manifest. `samples/examples/northwind/` is a sample admin, not a second product theme. Its config points at `samples/examples/northwind/manifest.yaml`, and that manifest sets `brand: emporion`.

**Author deck.** Slides, scripts, and widget prompts. This is the YAML pane. An AI generates this file and nothing else. A slide may override a color. The deck does not restate the mark or the type scale. `samples/examples/launch-review.yaml` is the sample talk.

**Presenter session.** Answers and taken notes for this run. They stay in the browser. Export and the handout merge them into the downloaded file. They are not written into the author deck while you record them.

## Boot

1. The base install is the app, the schema, and `samples/themes/`. Font files ship in `samples/themes/emporion/fonts/` and are named by that package's manifest.
2. A config file names the admin manifest. Precedence is the `--config` flag, then the `config` query parameter, then the boot screen asks.

   ```bash
   npm run dev -- --config samples/examples/northwind/web-slider.config.yaml
   npm run preview -- --config samples/examples/northwind/web-slider.config.yaml
   ```

   `?config=samples/examples/northwind/web-slider.config.yaml` is the same kind of path. The sample admin config is only this:

   ```yaml
   manifest: samples/examples/northwind/manifest.yaml
   ```

   A name with no slash, such as `manifest: emporion` or `brand: emporion`, loads `samples/themes/<name>/manifest.yaml`. The same rule applies to any package name. `brand` as a name uses the brand object in that package. When no flag and no query are set, the boot screen asks for a config file or a site path before any theme loads. A missing config is not replaced with a theme package. A path that contains `..` or is an absolute filesystem path fails validation. A missing manifest, a brand cycle, a missing mark or font, or invalid YAML stops the app and shows the error. It does not substitute another brand.
3. The user opens a deck YAML. Open loads only the talk, on top of the theme already loaded. The start screen lists the talks in `samples/catalog.yaml` and fetches the one you choose.

YAML is for files a person or an AI writes: the config, the manifest, and the deck. JSON is for artifacts only the system writes: an optional `manifest.resolved.json` cache beside the manifest, and the session. People do not edit those JSON files. This presenter resolves the manifest in memory. If `manifest.resolved.json` is present and its hash matches the manifest, it must agree with that resolution. A stale hash is ignored and the manifest is resolved again. This browser build does not write the cache file.

## Open a deck

After a config has loaded, the start screen and the Open icon take a `.yaml` or `.yml` talk, a `.zip` package, or a `.pptx` file. You can also drop a file onto the window. Open loads only that talk.

Opening a file replaces the deck on screen. This browser keeps that deck, the widget answers, and the notes taken during the talk. Download YAML to keep the answers and the notes. That download merges them into a new file. Comments from the original file are not copied into it. Opening that download restores the answers and notes into the session.

A `.zip` package has `deck.yaml` at the root and the files the deck names. Download one from the package icon in Export. The package does not contain the manifest, the mark, or the font files.

A `.pptx` import keeps each slide's title, bullets, and speaker notes. Pictures, charts, and animations in that file are left out.

## Theme

The manifest holds `brand`, `theme` (colors, type scale, chrome), optional `fonts`, the default `aspect`, and `showSlideNumber`. Unknown keys are rejected and the theme is not loaded. Omitted theme fields use the built-in defaults after the manifest validates.

A `brand` value that is a package name loads `samples/themes/<name>/manifest.yaml` and uses that file's brand object: `name`, `wordmark`, optional `tail`, `accent`, `highlight`, `mark`, and optional `markDark`. A brand written in place is that same mapping. A mark or font file is an `https` URL, a `data` URI, or a path relative to the manifest that declares it, such as `mark.svg` or `fonts/Inter-Regular.ttf`.

The lockup is the mark plus the wordmark, with the tail in the highlight color. It is drawn in the footer of every slide from the loaded theme, at `theme.type.mark` and `theme.type.wordmark`. Those sizes are the same on every slide. The audience window shows that slide, so it shows the lockup. The same lockup sits in the presenter toolbar. The Emporion package sets the wordmark `EMPORION`, the tail `AI`, accent `#3DB892`, and highlight `#E4B84A`.

`theme.type` is the rest of the slide type, in px: `title`, `section`, `slide`, `body`, `sub`, `author`, `table`, `footer`, and `caption`. When a field is omitted the defaults are title 58, section 52, slide 36, body 22, sub 20, author 16, table 18, footer 14, wordmark 12, mark 22, caption 18. `headingScale` (a positive number, at most 3) multiplies `title`, `section`, and `slide`. The slide and the exports use these sizes. The toolbar, panes, and buttons are the app shell. They are not in the manifest and they are not in the deck.

`theme.chrome` is `light` or `dark`. `chromeLight` and `chromeDark` set the shell colors `ground`, `paper`, `text`, `muted`, and `line`. `align` is `left` or `center`. `radius` is from 0 to 48. Built-in font names are Inter, Source Serif 4, and JetBrains Mono. Any other family needs a `fonts` entry with a `regular` file, and an optional `semibold` file, on the manifest that names the family.

Colors are `#rrggbb`.

## Deck

`brand`, `theme`, and `fonts` on the deck are rejected. They belong to the manifest. A slide may override `background`, `surface`, `text`, `muted`, and `accent` under `theme`. That slide `theme` is colors only. Type sizes, chrome, and fonts on a slide are rejected.

The contract for a generated talk is [prompts/generate-deck.md](prompts/generate-deck.md). The deck itself is:

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

Ids use letters, numbers, hyphens, or underscores, and start with a letter or number. Slide ids are unique in the deck. Widget ids are unique on the slide. Unknown keys are rejected and the deck is not shown.

A slide with `hidden: true` stays in the outline and overview, dimmed, and a click still opens it. Arrow keys skip it, and every export leaves it out. `autoAdvance` is a number of seconds, greater than 0 and at most 3600. The slide moves on only after its last build, and not while the audience screen is blank.

Layouts are `title`, `section`, `content`, and `quote`.

### Blocks

Use these on `blocks` and `side`. A `step` hides the block, or a list item, until you advance to it. `step` is a non-negative integer.

- `paragraph`: `text`
- `bullets` and `numbered`: `items` of `{ text, step? }`, at least one item
- `table`: `headers` and `rows`. Each row has one cell per header. Cells are strings.
- `chart`: `kind` is `bar` or `column`, plus `labels` and the same number of finite `values` (at most 12)
- `link`: `text`, plus either an `https` `href` or a `slide` id that exists in the deck. Exactly one of those.
- `video`: an `https` `src` and an optional `title`
- `quote`: `text`, optional `attribution`
- `code`: `code`, optional `language`. Omit `language` for plain text. The live view highlights `bash`, `css`, `html`, `javascript`, `json`, `jsx`, `markdown`, `python`, `tsx`, `typescript`, and `yaml`. Any other name fails when the slide is shown.
- `image`: `src`, optional `alt`. `src` is `https`, a `data` URI, or a package path. A path cannot start with `/` or contain `..`.
- `callout`: `text`
- `divider`

### Widgets

Widgets are `radio`, `checkbox`, `select`, `text`, and `scale` (1–5). `radio`, `checkbox`, and `select` need at least two `options`. A stored `answer` on `radio` or `select` must be one of the options. A checkbox `answer` is a list of options. Leave `answer` and slide `takenNotes` out of a new deck. They are how a downloaded session file round-trips. In an embedded deck the bottom row is the feedback form.

## Editor

The YAML pane beside the slide is the author deck. It is a syntax-highlighted YAML editor, not a free-form canvas. The decision is that one document: if a change cannot be written as legal YAML, the editor does not offer it. The AI path and the pane edit that same file.

A read-only session block in the same pane shows the current slide's taken notes and widget answers. It is labeled as this run. It is not the deck file.

Typing in the pane updates the slide when the YAML parses. When it does not parse, the error stays in the pane and the last valid slide stays on screen. Click a title, list item, block, widget, or footer to select that node in the author YAML, the way Chrome's element inspector selects a node. The lockup comes from the loaded theme, so it is not a node in the deck file. Clicking a widget selects `slides/N/widgets/M` in the author YAML. Move the caret in the YAML and the matching part of the slide is marked; if the caret is in another slide, the view jumps there. Double-click a title or list item to edit it. That writes the text back into the author YAML through the serializer, and comments in the pane are dropped at that moment. Focusing the taken-notes field points at the session block.

## Presenting

Arrow keys, space, and page up or down move through builds and then slides, skipping hidden slides. Type a visible slide number and press Enter to jump. Home and End jump to the ends. `O` opens the overview. `F` toggles full screen.

`B` blanks the audience window in black and `W` blanks it in white. Any other navigation key clears the blank and does not move. `L` toggles a laser pointer on the slide and sends it to the audience window. `C` toggles live captions from the microphone. If this browser has no speech recognition, or the microphone is blocked, captions stop and say why. Laser, captions, the blank screen, and the audience window are presenter controls. They are not deck fields.

The notes band shows a preview of the next visible slide. An audience icon opens a second window that follows this one: the slide, the build, the blank color, the laser, and the caption. That window does not show notes or widgets. The toolbar shows the clock beside the elapsed timer, and a restart icon resets the timer.

Chrome controls are icons. The name is the tooltip. A theme icon switches the shell between light and dark. Export and examples open from icons and close with Escape. The outline and the examples pane each have a pin and a close button. The notes band collapses. The slide does not.

## Embed

`embed.js` is product software. Host the built site, then on the customer page:

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

The script creates an iframe at `/?embed=1` on the slider origin, fetches `src`, and posts the talk into the frame. A `.yaml` file is sent as `{ type: "web-slider:load", yaml }`. A `.zip` is sent as `{ type: "web-slider:load", zip }`. The frame shows the slides, the lockup, and the bottom feedback row. Widget answers and notes come back as `web-slider:feedback`. If the deck request fails, the error replaces the host element.

The iframe uses the theme the slider was booted with. Start that site with `--config`, or open the frame with `?embed=1&config=...`. `embed.js` does not take a theme path. The host sends only the talk. A page can also iframe `/?embed=1&deck=` with an absolute deck URL.

## Exports

PDF embeds Inter, Source Serif 4, and JetBrains Mono, uses the loaded theme's type sizes, and uses the aspect for the page size. Word and PowerPoint name those fonts and the same sizes, but cannot embed the fonts from the browser, so a machine without them installed will substitute. The lockup is included. An SVG mark is drawn in the browser export. Code is syntax-colored in the live view and plain monospace in the files.

Hidden slides are left out. A chart is drawn in the live view and in the PDF. Word and PowerPoint write its labels and values as text. A video plays in the live view. The exports keep its title and `https` address. Images in the files must be PNG or JPEG.

The handout icon writes a Word file where each visible slide is followed by its script, widget prompts with the recorded answers, and the notes taken on that slide.
