# Agents

This repository is the presenter. It is not a folder for decks you were asked to write somewhere else.

## Another workspace

If the open workspace is not this repository, or the user asked for slides, a briefing, or a customer deck, you do not write here.

You do not add or edit `samples/`, `src/`, `docs/`, `prompts/`, `public/`, or any other path in this repo to hold that talk. You do not add a catalog line. You do not point `manifest` or `brand` at a theme shipped in this repository to skip building one. You do not point a font path into `samples/themes/`.

Write the talk in the workspace that owns the work, in the directory the user named. If they did not name a directory, ask. Do not choose `samples/` because this repo contains examples. Do not name or guess another workspace's directories.

If that talk needs its own look, build the theme beside the talk in that same folder: `manifest.yaml`, the mark files, and the font files. Those files belong with the talk. They are not a new product theme in this repository, and they are not an alias of a theme shipped here.

Boot that config with its absolute path. The dev server reads a `.yaml` path that starts with `/`. The browser does not fetch it as a site URL, and `samples/catalog.yaml` is not involved.

```bash
npm run dev -- --config /absolute/path/to/web-slider.config.yaml
```

## This repository

Touch `samples/` only when the user explicitly told you to change the shipped samples of Web Slider. "Add slides" is not that instruction. A file open in another workspace is not that instruction.

When you are changing this repository:

- A talk's shape is [prompts/generate-deck.md](prompts/generate-deck.md).
- A shipped theme's shape is [prompts/admin-theme.md](prompts/admin-theme.md).
- Presenter behavior is `src/`. The deck schema is [src/model/schema.ts](src/model/schema.ts). The config and manifest schema is [src/model/install.ts](src/model/install.ts).

Read [docs/agents.md](docs/agents.md) before you edit a shipped sample. The routing there does not apply to a deck that belongs in another workspace.
