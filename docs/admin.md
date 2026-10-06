# Dress the room

You are the admin. Before anyone writes a slide, you decide how the room looks: the mark, the wordmark, the colors, the type, and the fonts. The person who makes the slides never copies those choices into the talk. They open a YAML file of slides, and the theme you loaded is already on screen.

If you only want to make slides, skip this chapter and read [make-slides.md](make-slides.md). If you are an agent writing the files, the checklist is [prompts/admin-theme.md](../prompts/admin-theme.md).

## The four seats

Four seats share the app. You sit in the second.

1. **System.** The schema, the layouts, and the presenter. That is the software. You do not edit it to change a color.
2. **Admin.** You. The config names a manifest. The manifest is the brand and the theme.
3. **Author.** Slides, the speaker script, and the questions. One YAML file. It carries no brand.
4. **Presenter.** Notes and answers taken during the talk. They stay in the browser until a download. You do not put them in the manifest.

## Boot, in order

The app will not guess a theme.

1. The software is already there: the page, the schema, and `samples/themes/`.
2. A config names one manifest. Precedence is the `--config` flag, then the `config` query, then the boot screen asks.

   ```bash
   npm run dev -- --config samples/examples/northwind/web-slider.config.yaml
   npm run preview -- --config samples/examples/northwind/web-slider.config.yaml
   ```

   `?config=samples/examples/northwind/web-slider.config.yaml` is the same kind of path. With no flag and no query, the boot screen lists the installs in `samples/catalog.yaml` and also accepts a site path or a dropped config file.
3. Someone opens a talk. Open loads only that talk, on top of the theme already loaded.

A missing config is not replaced with a theme package. A missing manifest, a brand cycle, a missing mark or font, or invalid YAML stops the app and shows the error. It does not substitute another brand. A site path that contains `..` fails validation. An absolute file path is not a site URL. The dev server reads that file and passes its text. The catalog is not involved.

The config is only this:

```yaml
manifest: samples/examples/northwind/manifest.yaml
```

A name with no slash, such as `manifest: emporion` or `manifest: harbor`, loads `samples/themes/<name>/manifest.yaml`.

## Two ways to dress the room

**Use a product theme as it ships.** Emporion, Harbor, Ledger, and Meridian are folders under `samples/themes/`. Each has a manifest, a mark, and a dark mark. Your config names the package:

```yaml
manifest: harbor
```

The sample file for that line is `samples/examples/harbor/web-slider.config.yaml`. Emporion with no color overlay is `samples/examples/emporion/web-slider.config.yaml`.

**Recolor a product brand for one install.** This is an admin overlay, not a new product theme. Northwind is the sample. Its config points at its own manifest, and that manifest says `brand: emporion` and then sets Northwind's slide colors. The lockup stays the Emporion mark and wordmark. The folder is `samples/examples/northwind/`. Product themes stay in `samples/themes/`. A sample admin does not go there.

Harbor, Ledger, and Meridian are shipped product themes. They name the font files in `samples/themes/emporion/fonts/` so those faces are stored once inside this repository. An overlay that sets `brand: emporion` inherits that font map. A deck that lives in another workspace does not use either shortcut. Its theme, marks, and font files sit beside the talk.

## Where your files live

`public/` is the site. It holds `embed.js`. You do not write that file, and neither does the author. The built page is served from here too.

`samples/` is the install, at the repo root. Dev, preview, and the production build expose it at `/samples/`.

```
samples/
  catalog.yaml
  themes/
    emporion/                 # product theme; also holds the built-in font files
    harbor/
    ledger/
    meridian/
  examples/
    emporion/                 # config for Emporion, no color overlay
    northwind/                # admin overlay: config + manifest, brand emporion
    harbor/                   # config plus the Harbor briefing talk
    ledger/
    meridian/
    launch-review.yaml        # the talk for the Northwind install
```

`samples/catalog.yaml` is the list the screens read. `installs` are configs. `examples` are talks. Add a line when you add a file, or the boot screen and the start screen will not offer it. Each entry is an `id`, a `title`, and a site `path`.

YAML is for the files you and an author write: the config, the manifest, and the deck. JSON is for artifacts only the system writes: an optional `manifest.resolved.json` beside the manifest, and the session in the browser. This presenter resolves the manifest in memory. If that cache file is present and its hash matches the manifest, it must agree with the resolution. A stale hash is ignored. This browser build does not write the cache file. Do not hand-edit it.

## What the manifest holds

`brand`, `theme`, optional `fonts`, the default `aspect` (`16:9` or `4:3`), and `showSlideNumber`. Unknown keys are rejected and the theme is not loaded. Omitted theme fields use the built-in defaults after the manifest validates.

A `brand` value that is a package name loads that package and uses its brand object: `name`, `wordmark`, optional `tail`, `accent`, `highlight`, `mark`, and optional `markDark`. A brand written in place is that same mapping. A mark or font file is an `https` URL, a `data` URI, or a path relative to the manifest, such as `mark.svg` or `fonts/Inter-Regular.ttf`.

The lockup is the mark plus the wordmark, with the tail in the highlight color. It is drawn in the footer of every slide, in the audience window, and in the presenter toolbar, from the loaded theme. Authors do not paste the logo onto a slide. The Emporion package sets the wordmark `EMPORION`, the tail `AI`, accent `#3DB892`, and highlight `#E4B84A`.

`theme.type` is the slide type, in px: `title`, `section`, `slide`, `body`, `sub`, `author`, `table`, `footer`, `wordmark`, `mark`, and `caption`. Omitted sizes are title 58, section 52, slide 36, body 22, sub 20, author 16, table 18, footer 14, wordmark 12, mark 22, caption 18. `headingScale` (a positive number, at most 3) multiplies `title`, `section`, and `slide`. The slide and the exports use these sizes. The toolbar, panes, and buttons are the app shell. They are not in the manifest and they are not in the deck.

`theme.chrome` is `light` or `dark`. `chromeLight` and `chromeDark` set the shell colors `ground`, `paper`, `text`, `muted`, and `line`. `align` is `left` or `center`. `radius` is from 0 to 48. Slide colors are `background`, `surface`, `text`, `muted`, and `accent`. Colors are `#rrggbb`.

Built-in font names are Inter, Source Serif 4, and JetBrains Mono. Any other family needs a `fonts` entry with a `regular` file, and an optional `semibold` file, on the manifest that names the family. A product theme that carries its own brand object names all three built-in families so PDF export can embed them. Point those entries at `samples/themes/emporion/fonts/`.

A talk may set `aspect` and `showSlideNumber` when that talk differs from your defaults. A talk may set slide colors on one slide. It may not set type sizes, chrome, or fonts. Those stay yours.

The field-by-field checklist, including the font map to copy, is [prompts/admin-theme.md](../prompts/admin-theme.md).

## Host the talk on another page

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

## Hand someone a runnable package

A runnable package is one zip: the presenter, your theme, and one talk. The person you send it to needs no Node and no config path. They unpack it and double-click `Start.command` (macOS) or `Start.bat` (Windows), or run `./start.sh` (Linux). A bundled server starts on `127.0.0.1`, prints the link, and opens the browser on the talk. The window stays open while they present.

Build it from the running app. Boot with your theme on disk, open the talk, and choose Export → Runnable package:

```bash
npm run dev -- --config /absolute/path/to/web-slider.config.yaml
```

The same build from a shell:

```bash
npm run pack -- --deck /absolute/path/to/talk.yaml
npm run share -- \
  --config /absolute/path/to/web-slider.config.yaml \
  --deck /absolute/path/to/talk.zip \
  --out /absolute/path/to/talk-presenter.zip
```

`npm run pack` is the talk check. It writes `talk.zip` only when the talk names a local image; otherwise pass the YAML to `--deck` when share accepts a bare talk. When the talk names package paths, pass the zip pack wrote. The author story is [make-slides.md](make-slides.md#check-the-talk-on-disk).

The package carries `app/talk/web-slider.config.yaml` with `manifest: talk/manifest.yaml` and `deck: talk/deck.zip`. It also carries the marks, the fonts, and the font licences the manifest names, plus the talk. It does not carry `samples/`. The manifest must sit beside the config and carry its own marks; a brand package name is refused. A talk that names a file it does not carry is refused.

`deck:` is optional in any config. When a config sets it, boot opens that talk instead of the stored session, and `?deck=` outranks it. Open, drop, and Blank deck still load other talks under the same theme. Reset to shipped in the toolbar reads the config's talk again and discards edits, notes, and answers in this browser. A reload or a new start also opens the shipped talk, so recipients keep their notes with Export → YAML.

A fresh session shows Examples open and YAML closed. The YAML button is still in the toolbar.

The four server binaries live in `scripts/share/runtime/`. After you change `scripts/share-server/`, rebuild them with `npm run share:runtime`, which needs Go.

## What you hand the author

You hand them a running app with your theme loaded, and [make-slides.md](make-slides.md). They bring a YAML talk. They do not bring a second copy of your mark.
