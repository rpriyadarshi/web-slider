# Make the slides

You are here to make a talk and give it. The look of the room is already chosen: the mark, the colors, and the type. Your file is the slides, the words you will say, and the questions you will ask the room.

If the app is asking you to choose a config, pick a theme on that screen. That chooses the look. The talk comes next. The person who runs the install, and the files they edit, are in [admin.md](admin.md). If an agent will write the YAML for you, send it [prompts/generate-deck.md](../prompts/generate-deck.md).

## Open a talk

After a theme has loaded, the start screen offers three ways in.

- **Open YAML**, or drop a file on the window. A `.yaml` or `.yml` talk, a `.zip` package, or a `.pptx` file. Opening a file replaces the deck on screen. It does not replace the theme.
- **Blank deck.** One untitled slide, so you can build the talk in the presenter.
- **Examples.** The talks listed in the catalog: Launch Review, Harbor briefing, Quarterly close, and Incident review. Each one is slides only. It takes the theme you already loaded.

This browser keeps that deck, the widget answers, and the notes you take. Nothing is written back to the original file. Download YAML when you want a file that contains the answers and the notes. That download is a new file. Comments from the original are not copied into it. Opening that download restores the answers and notes into the session.

A `.zip` package has `deck.yaml` at the root and the files the deck names. Download one from the package icon in Export. The package does not contain the mark or the font files.

A `.pptx` import keeps each slide's title, bullets, and speaker notes. Pictures, charts, and animations in that file are left out.

## What you write

One YAML document. The pane beside the slide is that document. If a change cannot be written as legal YAML, the editor does not offer it.

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

`footer` is the line beside the lockup. The lockup itself is the theme's mark and wordmark. You do not add an image of the logo.

`notes` is the script. It is shown to you, not to the audience window. Questions go on `widgets`, not in the script.

Leave `takenNotes` and widget `answer` out of a new talk. Those are filled in while you present, and they come back when you download.

The strict key list, including every block and widget, is [prompts/generate-deck.md](../prompts/generate-deck.md). The presenter rejects a key it does not know, and it rejects `brand`, `theme`, and `fonts` on the deck. A single slide may set `background`, `surface`, `text`, `muted`, and `accent` under `theme`. That is colors only.

## Build it in the pane

The plus icon in the YAML pane inserts into the file:

- **Slide**, after the slide you are on.
- A **block** on the slide, or the same block in the **side** column.
- A **widget** on the decision row.
- **Remove**, for the block or widget the caret is in.
- **Remove slide**, except when it is the only slide.

Typing updates the slide when the YAML parses. When it does not parse, the error stays in the pane and the last valid slide stays on screen. Undo and redo are the curved arrows in the pane, and Ctrl+Z and Ctrl+Shift+Z (Ctrl+Y redoes as well). Tab indents. Ctrl+F finds and replaces in the file.

Click a title, list item, block, widget, or footer to select that part of the file. Clicking a widget selects the whole widget. Move the caret in the YAML and the matching part of the slide is marked. If the caret is in another slide, the view jumps there. Double-click a title or list item to edit it. That writes the text back into the YAML, and comments in the pane are dropped at that moment.

A read-only session block in the same pane shows the notes and answers recorded on this slide. It is labeled as this run. It is not the deck file.

## The shape of a talk

Five to twelve slides is enough. Open with `layout: title`. Use `section` as a break. Put the question on a `content` slide. `quote` is for one line.

Ids use letters, numbers, hyphens, or underscores, and start with a letter or number. Slide ids are unique in the talk. Widget ids are unique on that slide.

`hidden: true` keeps a slide in the outline, dimmed. Arrow keys skip it, and every export leaves it out. A click in the outline still opens it. Use that for an appendix.

`autoAdvance` is a number of seconds, greater than 0 and at most 3600. The slide moves on only after its last build, and not while the audience screen is blank. Omit it unless the deck is a kiosk.

`step` on a block or a list item hides it until you advance. The first press reveals the next step, then the next slide.

`aspect` is `16:9` or `4:3`, and `showSlideNumber` is true or false. Set them only when this talk differs from the theme.

### Blocks

Use these on `blocks` and on `side`. Side content is a short reference, not a second essay.

- `paragraph`: `text`
- `bullets` and `numbered`: `items` of `{ text, step? }`, at least one item
- `table`: `headers` and `rows`. Each row has one cell per header. Cells are strings.
- `chart`: `kind` is `bar` or `column`, plus `labels` and the same number of numbers (at most 12)
- `link`: `text`, plus either an `https` address or a slide id in this talk. One of those, not both.
- `video`: an `https` address, and an optional `title`
- `quote`: `text`, optional `attribution`
- `code`: `code`, optional `language`. Omit `language` for plain text. The live view highlights `bash`, `css`, `html`, `javascript`, `json`, `jsx`, `markdown`, `python`, `tsx`, `typescript`, and `yaml`. Any other name fails when the slide is shown.
- `image`: `src`, optional `alt`. `src` is `https`, a `data` URI, or a path inside the zip package. A path cannot start with `/` or contain `..`.
- `callout`: `text`
- `divider`

### Questions

The decision row is `widgets`. In an embedded talk that row is the feedback form.

- `radio`, `checkbox`, and `select`: `id`, `prompt`, and at least two `options`
- `text`: `id` and `prompt`
- `scale`: `id` and `prompt`, answered from 1 to 5. Do not add `options`.

One question on a slide is enough. Keep the prompt short.

## Give the talk

Arrow keys, space, and page up or down move through builds and then slides, skipping hidden slides. Type a visible slide number and press Enter to jump. Home and End jump to the ends. `O` opens the overview. `F` toggles full screen.

`B` blanks the audience window in black and `W` blanks it in white. Any other navigation key clears the blank and does not move. `L` toggles a laser pointer on the slide and sends it to the audience window. `C` toggles live captions from the microphone. If this browser has no speech recognition, or the microphone is blocked, captions stop and say why.

The notes band shows the script and a preview of the next slide. The audience icon opens a second window that follows this one: the slide, the build, the blank color, the laser, and the caption. That window does not show notes or questions. The toolbar shows the clock beside the elapsed timer, and a restart icon resets the timer.

The theme icon switches the shell between light and dark for this session. It does not edit the theme file. Export and the insert menu close with Escape. The outline, examples, YAML, presenter strip, and help each have a pin and a close button. Esc closes a floating pane and leaves a docked pane open.

## Help

The question mark in the toolbar, or `?`, opens the help pane. Pin docks it beside the slide, the same way as Examples and YAML. Unpin floats it, and Esc closes it while it floats. Hold the pointer on a control, or tab to it, to read what it does right now. In the YAML pane, hold the pointer on a key to read that field.

Laser, captions, the blank screen, and the audience window are controls. They are not fields in the YAML.

## Leave with a file

Export writes a new file. The original you opened is unchanged.

- **YAML** merges the answers and the notes into the talk so you can open them again.
- **PDF** uses the theme's type and the talk's aspect, and embeds Inter, Source Serif 4, and JetBrains Mono.
- **Word** and **PowerPoint** name those fonts and the same sizes. A machine without the fonts installed will substitute. A chart becomes its labels and values. A video becomes its title and address.
- **Handout** is a Word file: each visible slide, then its script, the questions with the recorded answers, and the notes taken on that slide.
- **Package** is a zip of `deck.yaml` and the images the talk names.

Hidden slides are left out. Images in the files must be PNG or JPEG. An SVG mark from the theme is drawn in the browser export. Code is colored on screen and plain monospace in the files.
