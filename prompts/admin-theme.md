# Write a Web Slider theme

You are the admin. You dress the room: the brand, the colors, the type, and the fonts. You do not write the slides. If the request is a talk, stop and follow [generate-deck.md](generate-deck.md). The routing rules are [docs/agents.md](../docs/agents.md). The human story is [docs/admin.md](../docs/admin.md).

The presenter rejects a manifest it cannot validate. Do not invent keys. The enforced schema is `manifestSchema` and `configSchema` in `src/model/install.ts`, and the theme and brand fields in `src/model/schema.ts`.

## What you write

Pick one of these. A product theme and an admin overlay are different files.

**Product theme.** A folder `samples/themes/<name>/` with `manifest.yaml`, `mark.svg`, `mark-on-dark.svg`, and `favicon.svg`. The package name is the folder name. A config then says `manifest: harbor` and the app loads `samples/themes/harbor/manifest.yaml`. Harbor, Ledger, and Meridian are product themes. Emporion is the product theme that also stores the font files.

**Admin overlay.** A folder `samples/examples/<name>/` with `web-slider.config.yaml` and `manifest.yaml`. The manifest sets `brand` to a package name and then sets its own slide colors. Northwind does this: `brand: emporion`, and the config points at `samples/examples/northwind/manifest.yaml`. This is how an admin recolors a product brand without becoming a second product theme. Do not put this folder under `samples/themes/`.

**Config only.** When the install uses a product theme with no color overlay, the config is the whole admin file:

```yaml
manifest: harbor
```

That file is `samples/examples/<name>/web-slider.config.yaml`. It is the path passed to `--config` and the path listed in the catalog.

**Catalog.** `samples/catalog.yaml` lists every install and every talk the screens show. Add an `installs` entry for a config you add. Add an `examples` entry only when you also added a talk, and write that talk with [generate-deck.md](generate-deck.md), not with this file.

You do not write:

- The talk, except the catalog path that points at a talk someone else writes.
- `embed.js` or anything under `public/`.
- `manifest.resolved.json`.
- A copy of the font binaries. The faces Inter, Source Serif 4, and JetBrains Mono already live in `samples/themes/emporion/fonts/`.

## Config

The config has one key.

```yaml
manifest: harbor
# or a site path, when the manifest is an admin overlay:
# manifest: samples/examples/northwind/manifest.yaml
```

A value with no slash is a package name and loads `samples/themes/<name>/manifest.yaml`. A value with a slash is a site path to a manifest. A filesystem path, a leading `/`, or a `..` segment is rejected. Unknown keys are rejected.

## Manifest

```yaml
brand: emporion          # a package name, or the brand object below
theme: {}                # optional; omitted fields use the built-in defaults after validation
fonts: {}                # required for a family that is not built in; see Fonts
aspect: "16:9"           # or "4:3"
showSlideNumber: true
```

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

`name`, `wordmark`, `accent`, `highlight`, and `mark` are required. `tail` and `markDark` are optional. A mark or font file is an `https` URL, a `data` URI, or a path relative to the manifest that declares it, such as `mark.svg`. A path cannot start with `/` or contain `..`. A path that already starts with `samples/` is kept as a site path, which is how Harbor names `samples/themes/emporion/fonts/Inter-Regular.ttf`.

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

The lockup is the mark plus the wordmark. The presenter draws it. Do not also draw it as an image on a slide. Slide type sizes come from this manifest. The toolbar and the buttons do not.

## Fonts

```yaml
fonts:
  Inter:
    regular: samples/themes/emporion/fonts/Inter-Regular.ttf
    semibold: samples/themes/emporion/fonts/Inter-SemiBold.ttf
  Source Serif 4:
    regular: samples/themes/emporion/fonts/SourceSerif4-Regular.ttf
    semibold: samples/themes/emporion/fonts/SourceSerif4-Semibold.ttf
  JetBrains Mono:
    regular: samples/themes/emporion/fonts/JetBrainsMono-Regular.ttf
    semibold: samples/themes/emporion/fonts/JetBrainsMono-Bold.ttf
```

A product theme whose `brand` is an object must name these three families, or PDF export cannot load them. Point `regular` and `semibold` at the Emporion files above.

An admin overlay that sets `brand: emporion` inherits Emporion's font map. It does not repeat the font files.

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

- The config has only `manifest`.
- A product theme lives under `samples/themes/<name>/` and its brand is an object with a mark file that exists.
- An admin overlay lives under `samples/examples/<name>/`, sets `brand` to a package name, and is not a second copy of that package's mark.
- You did not copy font binaries. Built-in faces point at `samples/themes/emporion/fonts/`.
- Every color is `#rrggbb`. Every asset path is `https`, `data`, or a relative path with no `..` and no leading `/`.
- A new family has a `fonts` entry with a `regular` file.
- `samples/catalog.yaml` has an `installs` entry for the config, and an `examples` entry only for a talk that exists.
- You did not put `brand`, `theme`, or `fonts` on a talk, and you did not write `embed.js`.
