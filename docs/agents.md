# Agents

Read [AGENTS.md](../AGENTS.md) first. If the talk belongs in another workspace, stop. You are not about to write a file in this repository.

This chapter is only for a change the user explicitly asked you to make to Web Slider's shipped samples. A customer deck or a briefing is not that change. Write it in the directory the user named, or ask. Do not invent a folder under `samples/`. Do not name another workspace's directories. Do not reuse a theme shipped in this repository as that deck's theme. Build the theme beside the talk.

This chapter tells you which file inside this repository, and which contract to follow. It does not repeat those contracts.

The story so far: an admin dresses the room, then an author writes a talk, then a presenter gives it. You are asked for one of those seats. Write that seat's file. Leave the others alone.

| The request is about | You are | Read, then stop |
| --- | --- | --- |
| Slides, a script, questions, a YAML talk, a zip of images | The author | [prompts/generate-deck.md](../prompts/generate-deck.md) |
| A theme, a brand, colors, chrome, fonts, a mark, a config, booting the app | The admin | [prompts/admin-theme.md](../prompts/admin-theme.md) |
| A new sample people can click on the boot or start screen | Admin, then author | Both contracts, in that order, then the catalog rules below |
| Keys, layouts, widgets, export, or `embed.js` behaving differently | The system | `src/`. Do not invent the behavior in a sample file |

The human versions of the same seats are [admin.md](admin.md) and [make-slides.md](make-slides.md). Read them when you need the story of how a person uses the file. The prompt files are the checklists.

## One request, one role

A talk file holds slides, the speaker script, and questions. The presenter rejects `brand`, `theme`, and `fonts` on that file.

A manifest holds the brand, the colors, the type scale, chrome, and fonts. A config file only names that manifest. A talk does not name a manifest.

`public/embed.js` is the served app. Neither seat writes it.

`manifest.resolved.json` is a cache the system may read. People do not edit it.

`takenNotes` on a slide and `answer` on a widget are the presenter session. Leave them out of a new talk. A download puts them back when someone is saving a session that was already given.

## A shipped sample is two files and a catalog line

This section applies only after [AGENTS.md](../AGENTS.md) has already allowed you to edit this repository. When the user asked you to add a shipped example to Web Slider:

1. If the look is new, write the theme with the admin contract. A product theme goes in `samples/themes/<name>/`. An admin who only recolors a product brand goes in `samples/examples/<name>/manifest.yaml` and sets `brand` to the package name. Northwind does this with `brand: emporion`.
2. Write the talk with the author contract. Put it beside that example's config. A talk on the built-in theme can sit at `samples/examples/<talk>.yaml`, as Launch Review does.
3. Add the config under `installs` in `samples/catalog.yaml`, and the talk under `examples`. The boot screen lists `installs`. The start screen lists `examples`. A path that is not in the catalog does not appear. A missing or invalid catalog is an error on those screens. It is not replaced with a built-in list.

The catalog entries are `id`, `title`, and `path`. The path is a site path such as `samples/examples/harbor/briefing.yaml`. It is not an absolute filesystem path, and it contains no `..`.

## What a wrong file looks like

These are the mistakes that make the presenter reject the work, or that put a second copy of the brand in the talk.

- A talk that opens with `brand:` or `fonts:`, or a slide that sets `fontHeading`, `chrome`, or `type`.
- A mark or a font file inside the talk zip.
- A sample admin placed under `samples/themes/`. That directory is product themes. Northwind is an admin and lives under `samples/examples/northwind/`.
- A talk, theme, config, or catalog line added here because someone asked for slides in another workspace.
- A theme whose `brand` is a package shipped under `samples/themes/`, or whose font paths point into that directory, so a shipped theme stands in for one that was never built.
- A config that inlines colors. The config's only key is `manifest`.
- A second schema, written in prose or in a new parser, that disagrees with `src/model/schema.ts`.

## After you write

Author checklist: the end of [prompts/generate-deck.md](../prompts/generate-deck.md).

Admin checklist: the end of [prompts/admin-theme.md](../prompts/admin-theme.md).

If you changed both a theme and a talk, confirm the talk still has no brand of its own and that the config points at the manifest you wrote.
