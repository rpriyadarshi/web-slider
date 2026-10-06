# Web Slider

A browser presenter for YAML slide decks. Open a talk, present it, record decisions and notes, then download YAML, PDF, Word, or PowerPoint. Nothing is written back to the original file.

## The story

A talk reaches the screen in three steps, and three people own them. Read the chapter for the seat you are in. The later chapters assume the earlier ones have happened.

1. **The admin dresses the room.** Brand, colors, type, and fonts. That is a config and a manifest, loaded before any slide opens. [docs/admin.md](docs/admin.md).
2. **The author writes the talk.** Slides, the script, and the questions. One YAML file, on top of the theme already loaded. Then they present, and the notes they take stay in the browser until a download. [docs/make-slides.md](docs/make-slides.md).
3. **An agent writes only the file for the seat it was given, and only in the workspace that asked.** A customer deck does not go in `samples/`. [AGENTS.md](AGENTS.md).

The system is the fourth seat: the schema, the layouts, and the presenter. Customers do not edit it. The deck schema is `src/model/schema.ts`. The config and manifest schema is `src/model/install.ts`. If a chapter and the schema disagree, the schema is what the app runs.

## Run

```bash
npm install
npm run dev -- --config samples/examples/northwind/web-slider.config.yaml
```

`npm test` checks the deck schema, navigation, PowerPoint import, and the exporters. `npm run build` produces the static site and copies `samples/` into `dist/samples/`. `npm run dev` and `npm run preview` take the same `--config` flag. With no flag and no `?config=` query, the boot screen asks for one.

Check a talk on disk, and build its package when it names local images:

```bash
npm run pack -- --deck /absolute/path/to/talk.yaml
```

That command uses the same deck schema and image checks as the presenter. It writes a zip only when the talk names a package path such as `diagrams/architecture.png`. It writes nothing when every image is an `https://` URL or a `data:` URI. Problems print on stderr and nothing is written. Exit 0 means the talk is ready: open the zip it names, or the YAML when it says no zip was written. Optional `--out /absolute/path/to/talk.zip` chooses the package path. The author chapter is [docs/make-slides.md](docs/make-slides.md).

## Where the files sit in the story

`public/` is the site. It holds `embed.js`. The admin does not write it, and neither does the author.

`samples/` is the install. The dev server, preview, and the production build expose it at `/samples/`.

```
samples/
  catalog.yaml                # installs on the boot screen, talks on the start screen
  themes/
    emporion/                 # product theme; also holds the built-in font files
    harbor/
    ledger/
    meridian/
  examples/
    emporion/                 # config for the Emporion theme, no color overlay
    northwind/                # an admin overlay: its own colors, Emporion's brand
    harbor/                   # config plus the Harbor briefing
    ledger/                   # config plus the quarterly close
    meridian/                 # config plus the incident review
    launch-review.yaml        # the talk for the Northwind install
```

The admin chapter explains this tree. The author chapter explains the talk files. The agent chapter explains which of them you may create.
