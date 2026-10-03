# Web Slider

A browser presenter for YAML slide decks. Open a file, present it, record decisions and notes, then download YAML, PDF, Word, or PowerPoint. Nothing is written back to the original file.

```bash
npm install
npm run dev
```

`npm test` checks the deck schema and the four exporters. `npm run build` produces the static site.

## Deck

Colors are `#rrggbb`. Fonts are `Inter`, `Source Serif 4`, or `JetBrains Mono`. Omitted theme fields use the built-in defaults after the file validates. Unknown keys and illegal values are rejected, and the deck is not shown.

```yaml
id: launch-review
title: Launch Review
theme:
  background: "#14181f"
  text: "#f4f1ea"
  accent: "#e2a354"
  fontHeading: Source Serif 4
  fontBody: Inter
  fontMono: JetBrains Mono
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
          - text: Second point
            step: 2
    side:
      - type: code
        language: yaml
        code: |
          id: scope
    widgets:
      - id: ship
        type: radio
        prompt: Ship?
        options: [Yes, No]
```

`brand: emporion` uses the built-in Court mark. A custom brand is a mapping with `name`, `wordmark`, optional `tail`, `accent`, `highlight`, and `mark` (`https`, a `data` URI, or a path inside a zip package). `theme.chrome` is `light` or `dark`. `chromeLight` and `chromeDark` set the shell colors `ground`, `paper`, `text`, `muted`, and `line`. Built-in fonts are Inter, Source Serif 4, and JetBrains Mono. Any other family needs a `fonts` entry whose files are data URIs or paths in the package.

A `.zip` package has `deck.yaml` at the root and the files the deck names. Open the zip in the presenter, or download one from the package icon in Export.

`footer` is drawn on every slide. `showSlideNumber` defaults to on. `aspect` is `16:9` or `4:3`. A slide with `hidden: true` stays in the outline and overview, dimmed, and is skipped by the arrow keys and by every export. `autoAdvance` is a number of seconds; the slide moves on only after its last build, and not while the audience screen is blank.

Layouts are `title`, `section`, `content`, and `quote`. Blocks are `paragraph`, `bullets`, `numbered`, `table`, `link`, `quote`, `code`, `image`, `callout`, and `divider`. A numbered list uses the same item shape as bullets. A table has `headers` and `rows`. A link has `text` plus either an `https` `href` or a `slide` id. A `step` on a block or list item stays hidden until you advance to it. Images must be `https` URLs or `data:` URIs, and exports accept PNG and JPEG only.

Widgets are `radio`, `checkbox`, `select`, `text`, and `scale` (1–5). Answers and taken notes are stored in this browser under the deck id. Opening a file replaces them with any `answer` and `takenNotes` already in that YAML. Download YAML to keep them; comments from the original file are not preserved.

## Presenting

Arrow keys, space, and page up or down move through builds and then slides, skipping hidden slides. Type a visible slide number and press Enter to jump. Home and End jump to the ends. `B` blanks the audience window in black and `W` blanks it in white; any other navigation key clears the blank without moving. `O` opens the overview. `F` toggles full screen. The notes band shows the next visible slide. An audience icon opens a second window that follows this one. The toolbar shows the clock beside the elapsed timer, and a restart icon resets the timer. Chrome controls are icons; the name is the tooltip. A theme icon switches the shell between light and dark. Export and examples open from icons and close with Escape. The outline and the notes band collapse. The slide does not.

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

`src` may be a `.yaml` file or a `.zip` package. The iframe shows the slides and the bottom feedback row. Widget answers and notes are posted to the host as `web-slider:feedback`. A page can also iframe `/?embed=1&deck=` with an absolute deck URL, or post `{ type: "web-slider:load", yaml }` into the frame.

## Generate a deck

Give an AI assistant [prompts/generate-deck.md](prompts/generate-deck.md). It is the contract for a YAML deck or a zip package, including the feedback widgets.

## Exports

PDF embeds Inter, Source Serif 4, and JetBrains Mono, and uses the deck aspect for the page size. Word and PowerPoint name those fonts but cannot embed them from the browser, so a machine without the fonts installed will substitute. Code is syntax-colored in the live view and plain monospace in the files. Hidden slides are left out. The handout icon writes a Word file where each visible slide is followed by its script, widget prompts with the recorded answers, and the notes taken on that slide.
