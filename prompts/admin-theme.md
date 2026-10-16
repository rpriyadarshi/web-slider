# Write a Web Slider theme

You are the admin. You dress the room: the brand, the colors, the type, and the fonts. You do not write the slides. If the request is a talk, stop and follow [generate-deck.md](generate-deck.md).

Write the theme in the owning workspace. Prefer a house theme that workspace already keeps for briefings when one exists. Otherwise write it beside the talk, with its own `web-slider.config.yaml`, `manifest.yaml`, mark files, and font files. You do not set `brand` to a package shipped in this repository. You do not point `fonts` into `samples/themes/`. That alias is not a theme. If they did not name a directory, ask. Do not guess another workspace's directories. [AGENTS.md](../AGENTS.md) is the rule. Boot with the absolute path to that config; the talk (or its zip package) opens after the theme loads.

The folders under `samples/themes/` and `samples/examples/` below are the shipped product samples. You add another one only when the user explicitly told you to change Web Slider's shipped samples. The routing for that case is [docs/agents.md](../docs/agents.md). The human story is [docs/admin.md](../docs/admin.md).

The presenter rejects a manifest it cannot validate. Do not invent keys. The enforced schema is `manifestSchema` and `configSchema` in `src/model/install.ts`, and the theme and brand fields in `src/model/schema.ts`.

## What you write

Pick one of these. A product theme and an admin overlay are different files.

**Product theme.** A folder `samples/themes/<name>/` with `manifest.yaml`, `mark.svg`, `mark-on-dark.svg`, and `favicon.svg`. The package name is the folder name. A config then says `manifest: harbor` and the app loads `samples/themes/harbor/manifest.yaml`. Harbor, Ledger, and Meridian are product themes. Emporion is the product theme that also stores the font files.

**Admin overlay.** A folder `samples/examples/<name>/` with `web-slider.config.yaml` and `manifest.yaml`. The manifest sets `brand` to a package name and then sets its own slide colors. Northwind does this: `brand: emporion`, and the config points at `samples/examples/northwind/manifest.yaml`. This is how an admin recolors a product brand without becoming a second product theme. Do not put this folder under `samples/themes/`.

**Config.** The config names the manifest and the deck. Both values are paths relative to the config file, unless `manifest` is a package name.

```yaml
manifest: manifest.yaml
deck: briefing.yaml
```

`deck` is the talk: a `.yaml`, `.yml`, or `.zip` beside the config. Loading the config opens that talk. Files named inside the manifest are read from the manifest's directory. Files named inside the deck are read from the deck's directory.

A product theme with no color overlay can still use a package name for the manifest, and still names the deck:

```yaml
manifest: harbor
deck: briefing.yaml
```

That file is `web-slider.config.yaml` beside the talk, or `samples/examples/<name>/web-slider.config.yaml` for a shipped sample. It is the path passed to `--config`.

**Catalog.** `samples/catalog.yaml` lists every install and every talk the screens show. Add an `installs` entry for a config you add. Add an `examples` entry only when you also added a talk, and write that talk with [generate-deck.md](generate-deck.md), not with this file.

You do not write:

- The talk, except the catalog path that points at a talk someone else writes, and only when that talk is a shipped sample.
- `embed.js` or anything under `public/`.
- `manifest.resolved.json`.
- A font path into `samples/themes/` for a theme that lives outside this repository. Put the face files beside that theme. Only a theme shipped in this repository shares the font files that already live here.

## Config

The config has two keys. `manifest` is required. `deck` is required when this config should open a talk.

```yaml
manifest: manifest.yaml
deck: briefing.yaml
```

`manifest: harbor` is a package name and loads `samples/themes/harbor/manifest.yaml`. Any other manifest value, and every `deck` value, is a path relative to this config file: `manifest.yaml`, `briefing.yaml`, `talk/deck.zip`, or `../../../Presentation/Themes/emporion/manifest.yaml`. `.` and `..` are steps in that path. A path cannot start with `/`. Unknown keys are rejected. The config does not inline colors, marks, or fonts.

## Manifest

```yaml
brand: emporion          # a package name, or the brand object below
theme: {}                # optional; omitted fields use the built-in defaults after validation
fonts: {}                # required for a family that is not built in; see Fonts
aspect: "16:9"           # or "4:3"; every slide in every talk on this theme uses this ratio
showSlideNumber: true
```

`aspect` is the slide page for the whole install. Authors do not invent a second ratio per slide. A talk may set `aspect` only when that one talk must differ from this default.

Unknown keys are rejected and the theme does not load.

A brand object, used by a product theme, is:

```yaml
brand:
  name: Harbor
  wordmark: HARBOR
  tail: AI                # optional; drawn in the highlight color
  accent: "#1B4F72"       # #rrggbb
  highlight: "#B0893E"
  mark: mark.svg          # required
  markDark: mark-on-dark.svg
```

`name`, `wordmark`, `accent`, `highlight`, and `mark` are required. `tail` and `markDark` are optional. A mark or font file is an `https` URL, a `data` URI, or a path relative to the manifest that declares it, such as `mark.svg` or `../emporion/fonts/Inter-Regular.ttf`. `.` and `..` are steps in that path. A path cannot start with `/`.

`brand: emporion` does not copy the brand object into your file. The app loads `samples/themes/emporion/manifest.yaml` and uses that package's brand. If that package is missing, the app stops. It does not substitute another brand. A cycle of package names stops the same way.

## Theme fields

All of these are optional. Colors are `#rrggbb`.

- Slide colors: `background`, `surface`, `text`, `muted`, `accent`.
- `fontHeading`, `fontBody`, `fontMono`. Built-in names are Inter, Source Serif 4, and JetBrains Mono.
- `align`: `left` or `center`.
- `headingScale`: a positive number, at most 3. It multiplies `title`, `section`, and `slide`.
- `radius`: 0 to 48.
- `highlight`: `#rrggbb`.
- `chrome`: `light` or `dark`.
- `chromeLight` and `chromeDark`: shell colors `ground`, `paper`, `text`, `muted`, `line`. These color the app chrome. They are not slide colors.
- `type`, in px: `title`, `section`, `slide`, `body`, `sub`, `author`, `table`, `footer`, `wordmark`, `mark`, `caption`. Each is a positive number within the schema maximum. Omitted sizes are title 58, section 52, slide 36, body 22, sub 20, author 16, table 18, footer 14, wordmark 12, mark 22, caption 18.
- `layouts`: the collection of page maps. This is the only place boxes are defined. A talk chooses a name from this collection. It does not draw its own boxes. Omit `layouts` and the presenter uses the default collection below. Manual insert lists every name you define, plus those defaults.

The lockup is the mark plus the wordmark. The presenter draws it. Do not also draw it as an image on a slide. Slide type sizes come from this manifest. The toolbar and the buttons do not.

## Layouts

A layout is a named map of boxes. A box is a percentage of the page: `x`, `y`, `w`, and `h`, each from 0 to 100, and `x + w` and `y + h` stay within 100. Boxes on one layout do not overlap. The footer box and the body box do not share space. Add a name when a talk needs an arrangement the collection does not have (a diagram page, a quadrant, a tall brief). The talk then sets `layout` to that name. A name is letters, numbers, and hyphens.

A theme that omits `layouts` gets this collection. The footer band is the same box on every layout, so the lockup does not move.

- `title` — opening page. Title, subtitle, and author, centered. Footer band.
- `section` — section break. Centered section title. Footer band.
- `content` — ordinary page. Title across the top, body in the middle, footer band.
- `quote` — one-line close, also used as the end page. Centered line and attribution. Footer band.

```yaml
layouts:
  title:
    title: { x: 8, y: 22, w: 84, h: 16 }
    subtitle: { x: 8, y: 40, w: 84, h: 10 }
    author: { x: 8, y: 52, w: 84, h: 8 }
    footer: { x: 6, y: 88, w: 88, h: 8 }
  section:
    title: { x: 8, y: 36, w: 84, h: 16 }
    footer: { x: 6, y: 88, w: 88, h: 8 }
  content:
    title: { x: 6, y: 5, w: 88, h: 14 }
    body: { x: 6, y: 20, w: 88, h: 66 }
    footer: { x: 6, y: 88, w: 88, h: 8 }
  quote:
    body: { x: 10, y: 24, w: 80, h: 52 }
    footer: { x: 6, y: 88, w: 88, h: 8 }
```

Region names the presenter places are `title`, `subtitle`, `author`, `body`, `side`, and `footer`. The presenter scales type and graphics inside a box only when the content does not fit, from 1 down until the text fits, and stops at 0.15. Authors are told to fit at scale 1. Do not build a layout that only works after that shrink. A row of aligned columns shares that size. The theme accent marks the recommended column's labels, and the theme highlight is the second emphasis. Do not add a hex so a column can imitate another deck's navy, cyan, or orange.

## Fonts

```yaml
fonts:
  Inter:
    regular: fonts/Inter-Regular.ttf
    semibold: fonts/Inter-SemiBold.ttf
  Source Serif 4:
    regular: fonts/SourceSerif4-Regular.ttf
    semibold: fonts/SourceSerif4-Semibold.ttf
  JetBrains Mono:
    regular: fonts/JetBrainsMono-Regular.ttf
    semibold: fonts/JetBrainsMono-Bold.ttf
```

A product theme shipped in this repository whose `brand` is an object must name these three families, or PDF export cannot load them. Emporion names `fonts/Inter-Regular.ttf` beside its own manifest. Harbor, Ledger, and Meridian name `../emporion/fonts/Inter-Regular.ttf`, which is the same file relative to their manifest. A path in a file is relative to that file. `..` is a step. The next file repeats the rule from its own directory.

A theme written for another workspace does not use those paths. Its `fonts` entries are files beside its own manifest.

An admin overlay shipped here that sets `brand` to the theme package inherits that package's font map. That is Northwind. It is not the way to theme a deck outside this repository.

Any other family name needs a `fonts` entry with a `regular` file on the manifest that names the family. `semibold` is optional. Put that file beside the manifest, or name a site path that already exists. Do not copy a file that already has a site path.

## Catalog

```yaml
installs:
  - id: harbor
    title: Harbor
    path: samples/examples/harbor/web-slider.config.yaml
examples:
  - id: harbor-briefing
    title: Harbor briefing
    path: samples/examples/harbor/briefing.yaml
```

Ids are unique inside each list and use letters, numbers, hyphens, or underscores. `path` is a site path ending in `.yaml` or `.yml`.

## Check

Before you finish, confirm:

- The config names `manifest` and, when it opens a talk, `deck`. Both paths are relative to the config file, except a package name such as `manifest: harbor`.
- A product theme lives under `samples/themes/<name>/` and its brand is an object with a mark file that exists.
- An admin overlay lives under `samples/examples/<name>/`, sets `brand` to a package name, and is not a second copy of that package's mark.
- A theme outside this repository has its own font files. It does not point into `samples/themes/`. A theme shipped in this repository may.
- Every color is `#rrggbb`. Every asset path is `https`, `data`, or a relative path with no `..` and no leading `/`.
- A new family has a `fonts` entry with a `regular` file.
- `layouts` names the slide maps. Boxes stay on the page and do not overlap. A shipped sample theme writes title, section, content, and quote. A sample talk has no `regions` key.
- `samples/catalog.yaml` has an `installs` entry for the config, and an `examples` entry only for a talk that exists.
- You did not put `brand`, `theme`, or `fonts` on a talk, and you did not write `embed.js`.
