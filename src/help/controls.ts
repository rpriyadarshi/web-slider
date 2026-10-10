import type { IconName } from "../layout/IconButton";
import type { ShortcutId } from "./keys";

export type ControlGroup = "move" | "present" | "panes" | "files" | "export" | "yaml";

export type Control = {
  id: string;
  label: string;
  icon?: IconName;
  group: ControlGroup;
  shortcut?: ShortcutId;
  about: string;
  shareHidden?: boolean;
};

const CONTROL_LIST = [
  { id: "previous", label: "Previous", icon: "previous", group: "move", shortcut: "back", about: "Go back one build, then one slide. Hidden slides are skipped." },
  { id: "next", label: "Next", icon: "next", group: "move", shortcut: "forward", about: "Reveal the next build, then go to the next slide. Hidden slides are skipped." },
  { id: "clock", label: "Clock", group: "present", about: "The time of day on this window." },
  { id: "elapsed", label: "Elapsed time", group: "present", about: "How long this session has been open. Restart sets it back to zero. The clock does not change." },
  { id: "restart", label: "Restart timer", icon: "restart", group: "present", about: "Set the elapsed timer back to zero. The clock does not change." },
  { id: "laser", label: "Laser pointer", icon: "laser", group: "present", shortcut: "laser", about: "Turn on a pointer. Move over the slide. The audience window follows." },
  { id: "captions", label: "Captions", icon: "captions", group: "present", shortcut: "captions", about: "Turn on live captions from the microphone. They show on this window and the audience window." },
  { id: "audience", label: "Audience window", icon: "audience", group: "present", about: "Open a second window that follows this one: the slide, the build, a blank screen, the laser, and captions. It does not show notes or questions." },
  { id: "overview", label: "Overview", icon: "overview", group: "present", shortcut: "overview", about: "Show every slide and jump to one." },
  { id: "zoom-out", label: "Zoom out", icon: "zoomOut", group: "present", shortcut: "zoom-out", about: "Make the slide smaller on the stage." },
  { id: "zoom-in", label: "Zoom in", icon: "zoomIn", group: "present", shortcut: "zoom-in", about: "Make the slide larger on the stage. Scroll when it exceeds the window." },
  { id: "zoom-fit", label: "Fit slide", icon: "zoomFit", group: "present", shortcut: "zoom-fit", about: "Fit the slide to the stage. Clears zoom in or out." },
  { id: "fullscreen", label: "Full screen", icon: "fullscreen", group: "present", shortcut: "fullscreen", about: "Fill the screen with this window, or leave full screen." },
  { id: "outline", label: "Outline", icon: "outline", group: "panes", about: "The list of slides. A dimmed slide is hidden: arrow keys skip it, and a click still opens it." },
  { id: "presenter", label: "Presenter", icon: "notes", group: "panes", about: "Decisions, the script, the notes you take, and a preview of the next slide." },
  { id: "examples", label: "Examples", icon: "examples", group: "panes", about: "The side column of this slide. A short reference, not the talk itself." },
  { id: "yaml", label: "YAML", icon: "yaml", group: "panes", about: "The talk file. Edits show on the slide when the YAML parses." },
  { id: "help", label: "Help", icon: "help", group: "panes", shortcut: "help", about: "Open this guide. It follows the slide, block, or question you select." },
  { id: "pin", label: "Pin", icon: "pin", group: "panes", about: "Dock the pane beside the slide. Unpin to float it over the slide. Esc closes a floating pane and leaves a docked pane open." },
  { id: "hide", label: "Hide", icon: "hide", group: "panes", about: "Close the pane. Open it again from the toolbar or the corner of the slide." },
  { id: "home", label: "Home", icon: "home", group: "files", about: "Leave this talk and return to the start screen. It sits beside the brand. Open another sample, a recent talk, or a file. Continue returns to this talk." },
  { id: "open", label: "Open", icon: "open", group: "files", about: "Open a YAML talk, a zip package, or a PowerPoint file. The theme stays as it is." },
  { id: "shipped", label: "Reset to shipped", icon: "shipped", group: "files", about: "Replace the current slides and the notes you took with the talk this install shipped." },
  { id: "theme", label: "Theme", icon: "theme", group: "files", about: "Switch the shell between light and dark for this session. This does not edit the theme file." },
  { id: "light", label: "Light", icon: "light", group: "files", about: "Use the light shell for this session. This does not edit the theme file." },
  { id: "dark", label: "Dark", icon: "dark", group: "files", about: "Use the dark shell for this session. This does not edit the theme file." },
  { id: "export", label: "Export", icon: "export", group: "files", about: "Download the talk. The original file is left unchanged." },
  { id: "export-yaml", label: "YAML", icon: "yaml", group: "export", about: "A YAML file with the answers and the notes you took merged in, so opening it restores this session. Comments from the original are not copied." },
  { id: "export-pdf", label: "PDF", icon: "pdf", group: "export", about: "A PDF in the talk's aspect. It embeds the theme fonts." },
  { id: "export-word", label: "Word", icon: "word", group: "export", about: "A Word file. It names the theme fonts and substitutes if they are not installed. A chart becomes its labels and values. A Mermaid diagram is drawn as a picture. A video becomes its title and address." },
  { id: "export-powerpoint", label: "PowerPoint", icon: "powerpoint", group: "export", about: "A PowerPoint file. It names the theme fonts and substitutes if they are not installed. A chart becomes its labels and values. A Mermaid diagram is drawn as a picture. A video becomes its title and address." },
  { id: "export-package", label: "Package", icon: "package", group: "export", about: "A zip of deck.yaml and the images the talk names. It does not contain the mark or the font files." },
  { id: "export-runnable", label: "Runnable package", icon: "runnable", group: "export", shareHidden: true, about: "That zip plus a presenter the recipient can start without installing Node. The banner shows the command." },
  { id: "export-handout", label: "Handout", icon: "notes", group: "export", about: "A Word file: each visible slide, then its script, the questions with the recorded answers, and the notes taken on that slide." },
  { id: "undo", label: "Undo", icon: "undo", group: "yaml", about: "Undo the last edit in the YAML." },
  { id: "redo", label: "Redo", icon: "redo", group: "yaml", about: "Redo the edit you just undid." },
  { id: "find", label: "Find", icon: "find", group: "yaml", about: "Find and replace in the YAML." },
  { id: "insert", label: "Insert", icon: "insert", group: "yaml", about: "Add a slide, a block, a side block, or a question at the caret." },
  { id: "remove", label: "Remove", group: "yaml", about: "Delete the block or question at the caret." },
  { id: "remove-slide", label: "Remove slide", group: "yaml", about: "Delete the current slide. The last slide cannot be removed." },
] as const satisfies readonly Control[];

export const CONTROLS: readonly Control[] = CONTROL_LIST;

export type ControlId = (typeof CONTROL_LIST)[number]["id"];

export function control(id: ControlId): Control {
  const found = CONTROLS.find((item) => item.id === id);
  if (!found) throw new Error(`No help for control ${id}.`);
  return found;
}

export const CONTROL_GROUPS: readonly { id: ControlGroup; title: string }[] = [
  { id: "move", title: "Moving" },
  { id: "present", title: "Presenting" },
  { id: "panes", title: "Panes" },
  { id: "files", title: "Files" },
  { id: "export", title: "Export" },
  { id: "yaml", title: "YAML editor" },
];
