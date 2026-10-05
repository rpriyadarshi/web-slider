export type Topic = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

export const TOPICS: readonly Topic[] = [
  {
    id: "start",
    title: "Start here",
    paragraphs: [
      "Open a YAML talk, a zip package, or a PowerPoint file from the toolbar, or drop one on the window. PowerPoint import keeps each slide's title, bullets, and speaker notes. Pictures, charts, and animations in that file are left out.",
      "Blank deck starts from one untitled slide. The theme you already loaded stays. Opening a file does not change it.",
      "This browser keeps the deck, the answers, and the notes you take. Nothing is written back to the original file. Download YAML when you want a file that contains the answers and the notes.",
      "The question mark in the toolbar, or ?, opens this pane. Hold the pointer on a control, or tab to it, to read what it does right now.",
    ],
  },
  {
    id: "move",
    title: "Move through the talk",
    paragraphs: [
      "Right arrow, down arrow, Page Down, and Space reveal the next build, then the next slide. Left arrow, up arrow, and Page Up go back. Hidden slides are skipped.",
      "Home and End jump to the ends. Type a visible slide number and press Enter. O opens a grid of every slide. F fills the screen.",
      "Ctrl, Alt, and the Command key do not trigger these shortcuts, so copying and other system shortcuts keep working.",
    ],
  },
  {
    id: "present",
    title: "Present to a room",
    paragraphs: [
      "The audience icon opens a second window that follows this one: the slide, the build, a blank screen, the laser, and captions. It does not show notes or questions.",
      "B blanks that window black and W blanks it white. Any other key brings the slide back and does not move. L toggles a pointer. Move over the slide and the audience window follows.",
      "C toggles live captions from the microphone. If this browser has no speech recognition, or the microphone is blocked, captions stop and say why.",
      "The toolbar shows the clock beside the elapsed timer. Restart sets the elapsed timer back to zero and leaves the clock alone.",
    ],
  },
  {
    id: "panes",
    title: "Panes",
    paragraphs: [
      "Outline, Examples, YAML, Presenter, and Help each open from the toolbar. Pin docks a pane beside the slide. Unpin lets it float, and Esc closes a floating pane. A docked pane stays. Drag a pane's edge to resize it.",
      "A closed pane also has a button on the corner of the slide. Examples are the side column of the current slide. Presenter shows the decisions, the script, the notes you take, and the next slide.",
    ],
  },
  {
    id: "edit",
    title: "Edit the talk",
    paragraphs: [
      "The YAML pane is the talk file. Typing updates the slide when the YAML parses. When it does not, the error stays in the pane and the last valid slide stays on screen. Insert and remove wait until it parses.",
      "The plus icon inserts a slide after the one the caret is in, a block, the same block in the side column, or a question. Remove deletes the block or question at the caret. Remove slide deletes the slide, unless it is the only one.",
      "Click a title, list item, block, question, or footer to select that part of the file. Move the caret and the matching part is marked. If the caret is in another slide, the view jumps there. Double-click a title or list item to edit it. That writes the text back into the YAML.",
      "Undo and redo are the curved arrows. Tab indents. Ctrl+F finds and replaces. Hold the pointer on a key in the YAML to read that field.",
    ],
  },
  {
    id: "questions",
    title: "Questions and notes",
    paragraphs: [
      "Questions are the decision row. Radio, checkbox, and select need at least two options. Text is a short answer. Scale is 1 to 5. One question on a slide is enough.",
      "The script is what you say. Taken notes are what you write during the talk. Answers and taken notes stay in this browser until you download YAML. The session block in the YAML pane shows both for this slide. It is this run, not the deck file.",
    ],
  },
  {
    id: "files",
    title: "Files",
    paragraphs: [
      "A YAML file is the talk. A zip package has deck.yaml at the root and the images the talk names. It does not contain the mark or the font files. Drop a .yaml file, a .zip package, or a .pptx file anywhere on the window.",
      "Reset to shipped replaces the slides and the notes you took with the talk this install shipped. Comments in the original are not copied into a YAML download.",
    ],
  },
  {
    id: "export",
    title: "Export",
    paragraphs: [
      "Export writes a new file. The original you opened is unchanged. Hidden slides are left out.",
      "YAML merges the answers and the notes into the talk so you can open them again. PDF embeds the theme fonts. Word and PowerPoint name those fonts and substitute if they are not installed. A chart becomes its labels and values. A video becomes its title and address.",
      "Handout is a Word file: each visible slide, then its script, the questions with the recorded answers, and the notes taken on that slide. Package is a zip of deck.yaml and the images the talk names. Runnable package is that zip plus a presenter the recipient can start. The banner shows the command.",
    ],
  },
  {
    id: "trouble",
    title: "When something goes wrong",
    paragraphs: [
      "If the YAML does not parse, the last valid slide stays up and insert and remove wait. The error is in the YAML pane and at the top of this pane.",
      "If notes could not be stored in this browser, a banner asks you to download YAML before you leave.",
      "If captions cannot start, the banner says why: this browser has no speech recognition, or the microphone was blocked.",
      "After an export, the banner names the file or shows the command to share a runnable package. Hide dismisses it. If the browser refused to write the file, Save again downloads the finished package.",
    ],
  },
];
