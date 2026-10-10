# Agents

This repository is the presenter. It is not a folder for decks you were asked to write somewhere else.

## Another workspace

If the open workspace is not this repository, or the user asked for slides, a briefing, or a customer deck, you do not write here.

You do not add or edit `samples/`, `src/`, `docs/`, `prompts/`, `public/`, or any other path in this repo to hold that talk. You do not add a catalog line. You do not point `manifest` or `brand` at a theme shipped in this repository to skip building one. You do not point a font path into `samples/themes/`.

Write the talk in the workspace that owns the work, in the directory the user named. If they did not name a directory, ask. Do not choose `samples/` because this repo contains examples. Do not name or guess another workspace's directories.

If that talk needs its own look, the theme is the admin seat: [prompts/admin-theme.md](prompts/admin-theme.md). Prefer a house theme the workspace already keeps for briefings when one exists. Otherwise build the theme beside the talk: `web-slider.config.yaml`, `manifest.yaml`, the mark files, and the font files. Those files belong with the talk. They are not a new product theme in this repository, and they are not an alias of a theme shipped here. Do not set `brand` or font paths at `samples/themes/` in this repository.

The admin seat boots that config with its absolute path. The dev server reads a `.yaml` path that starts with `/`. The browser does not fetch it as a site URL, and `samples/catalog.yaml` is not involved.

```bash
npm run dev -- --config /absolute/path/to/web-slider.config.yaml
```

Then open the talk from the start screen or by dropping the file on the window. Opening a talk does not replace the theme.

### Finish

From this repository, before the talk is finished:

```bash
npm run pack -- --deck /absolute/path/to/talk.yaml
```

That command is the presenter's check. It parses the talk with `deckSchema`, and it uses the same image and code-language checks the presenter uses. It writes a zip only when an `image.src` is a package path, and only after each of those files is a PNG or JPEG beside the talk. It writes nothing when every image is an `https://` URL or a `data:` URI. Problems are printed and nothing is written. The talk is finished when the command exits 0. Open the zip it names, or the YAML when it says no zip was written. Do not write a zip script of your own.

### Aspect

The theme manifest sets `aspect` (`16:9` or `4:3`). Every slide shares that page. The page has three regions: the title, one visual that fills the rest of the body, and the footer the presenter draws. Do not write decks that need a taller or scrolling stage to show the content. One primary visual per content slide; put a second visual on the next slide or in `side`. A Mermaid diagram whose labels would render smaller than the theme footer type does not fit: split the slide. The presenter will not draw that diagram. Author checklist: [prompts/generate-deck.md](prompts/generate-deck.md).

### Diagrams

Prefer native Mermaid. If the diagram can be expressed in Mermaid, put it in the talk as `type: mermaid`. Do not invent `type: code` with `language: mermaid`. Do not pre-render Mermaid to PNG with `mmdc` and an `image` block unless the user asked for a static raster, or Mermaid cannot draw that diagram.

```yaml
- type: mermaid
  source: |
    flowchart LR
      A --> B
  caption: Optional label
```

The presenter draws it live. PDF, Word, and PowerPoint rasterize it in the browser. Pack does not need a PNG for that block.

For other diagram tools only (or a static raster the user asked for):

1. Keep sources beside the talk, for example `diagrams/*.mmd`.
2. Render them to PNG or JPEG beside the talk. `mmdc` from `@mermaid-js/mermaid-cli` is fine; headless Chrome may need `MMDC_PUPPETEER_CONFIG`.
3. In the talk YAML, point `image.src` at package paths such as `diagrams/architecture.png`. A path must not start with `/` and must not contain `..`.
4. Run the finish command above. It packs those files. A bare `.yaml` file cannot resolve package paths.

The zip has `deck.yaml` at the root and the files the talk names. It does not contain the manifest, marks, or fonts. Rebuild by running the finish command again whenever the YAML or a packaged diagram changes.

Author checklist: [prompts/generate-deck.md](prompts/generate-deck.md). Theme checklist: [prompts/admin-theme.md](prompts/admin-theme.md). Human package story: [docs/make-slides.md](docs/make-slides.md).

## This repository

Touch `samples/` only when the user explicitly told you to change the shipped samples of Web Slider. "Add slides" is not that instruction. A file open in another workspace is not that instruction.

When you are changing this repository:

- A talk's shape is [prompts/generate-deck.md](prompts/generate-deck.md).
- A shipped theme's shape is [prompts/admin-theme.md](prompts/admin-theme.md).
- Presenter behavior is `src/`. The deck schema is [src/model/schema.ts](src/model/schema.ts). The config and manifest schema is [src/model/install.ts](src/model/install.ts).

Read [docs/agents.md](docs/agents.md) before you edit a shipped sample. The routing there does not apply to a deck that belongs in another workspace.
