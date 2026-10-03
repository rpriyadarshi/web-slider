import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";
import { BLOCK_KINDS, BLOCK_LABEL, WIDGET_KINDS, WIDGET_LABEL } from "../model/insert";
import { caretSelection } from "../model/probe";
import type { Block, Widget } from "../model/schema";
import { Icon, IconButton, IconMark } from "./IconButton";

const yamlHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "var(--muted)", fontStyle: "italic" },
  { tag: tags.propertyName, color: "var(--accent)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--highlight)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--text)" },
  { tag: tags.keyword, color: "var(--accent)" },
  { tag: [tags.punctuation, tags.separator, tags.meta, tags.derefOperator], color: "var(--muted)" },
  { tag: tags.labelName, color: "var(--highlight)" },
]);

const setProbeMark = StateEffect.define<{ from: number; to: number } | null>();

const probeMark = StateField.define({
  create() {
    return Decoration.none;
  },
  update(marks, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(setProbeMark)) continue;
      const range = effect.value;
      if (!range) return Decoration.none;
      const doc = transaction.state.doc;
      const from = Math.max(0, Math.min(range.from, doc.length));
      const to = Math.max(from, Math.min(range.to, doc.length));
      const first = doc.lineAt(from);
      const last = doc.lineAt(to === from ? from : Math.max(from, to - 1));
      const lines = [];
      for (let number = first.number; number <= last.number; number += 1) {
        lines.push(Decoration.line({ class: "cm-yaml-probe" }).range(doc.line(number).from));
      }
      return Decoration.set(lines, true);
    }
    return marks.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const yamlTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "var(--ground)",
    color: "var(--text)",
    fontSize: "12px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    lineHeight: "1.45",
    overflow: "auto",
  },
  ".cm-content": { caretColor: "var(--text)" },
  ".cm-gutters": {
    backgroundColor: "var(--paper)",
    color: "var(--muted)",
    borderRight: "1px solid var(--line)",
  },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "transparent" },
});

export function YamlPane({
  value,
  error,
  pinned,
  selection,
  sessionText,
  sessionLit,
  sessionMark,
  onChange,
  onCaret,
  onPin,
  onHide,
  onInsertSlide,
  onInsertBlock,
  onInsertWidget,
  onRemove,
  canRemove,
  onRemoveSlide,
  canRemoveSlide,
  className,
}: {
  value: string;
  error: string | null;
  pinned: boolean;
  selection: { start: number; end: number; token: number } | null;
  sessionText: string;
  sessionLit: boolean;
  sessionMark: number;
  onChange: (value: string) => void;
  onCaret: (offset: number, jump: boolean) => void;
  onPin: () => void;
  onHide: () => void;
  onInsertSlide: () => void;
  onInsertBlock: (place: "blocks" | "side", type: Block["type"]) => void;
  onInsertWidget: (type: Widget["type"]) => void;
  onRemove: () => void;
  canRemove: boolean;
  onRemoveSlide: () => void;
  canRemoveSlide: boolean;
  className: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applying = useRef(false);
  const selectGen = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const onChangeRef = useRef(onChange);
  const onCaretRef = useRef(onCaret);
  onChangeRef.current = onChange;
  onCaretRef.current = onCaret;

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          yaml(),
          syntaxHighlighting(yamlHighlight),
          yamlTheme,
          probeMark,
          EditorState.tabSize.of(2),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (applying.current) return;
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.selectionSet) {
              const userEdit = update.transactions.some(
                (transaction) => transaction.isUserEvent("select") || transaction.isUserEvent("input"),
              );
              if (!userEdit) return;
              const head = update.state.selection.main.head;
              const pointer = update.transactions.some((transaction) => transaction.isUserEvent("select.pointer"));
              onCaretRef.current(head, pointer);
              const gen = ++selectGen.current;
              queueMicrotask(() => {
                if (selectGen.current !== gen) return;
                const editor = viewRef.current;
                if (!editor) return;
                const doc = editor.state.doc.toString();
                const caret = Math.min(head, doc.length);
                const range = caretSelection(doc, caret);
                const mark = range ? { from: range.start, to: range.end } : null;
                const expand = pointer && editor.state.selection.main.empty && range;
                applying.current = true;
                editor.dispatch({
                  selection: expand ? { anchor: range.start, head: range.end } : undefined,
                  effects: setProbeMark.of(mark),
                  scrollIntoView: Boolean(expand),
                });
                applying.current = false;
              });
            }
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    applying.current = true;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    applying.current = false;
  }, [value]);

  useEffect(() => {
    if (sessionMark === 0) return;
    sessionRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [sessionMark]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  function choose(action: () => void) {
    setMenuOpen(false);
    action();
  }

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !selection) return;
    const end = Math.min(selection.end, view.state.doc.length);
    const start = Math.min(selection.start, end);
    applying.current = true;
    view.dispatch({
      selection: { anchor: start, head: end },
      effects: setProbeMark.of(end > start ? { from: start, to: end } : null),
      scrollIntoView: true,
    });
    applying.current = false;
  }, [selection?.token]);

  return (
    <section className={className} aria-label="YAML">
      <div className="panel-head">
        <IconMark label="YAML" name="yaml" />
        <div className="panel-actions">
          <div className="menu-anchor" ref={menuRef}>
            <IconButton label="Insert" pressed={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
              <Icon name="insert" />
            </IconButton>
            {menuOpen ? (
              <div className="insert-menu" role="menu" aria-label="Insert">
                <button type="button" role="menuitem" onClick={() => choose(onInsertSlide)}>
                  Slide
                </button>
                <p className="insert-label">Blocks</p>
                {BLOCK_KINDS.map((type) => (
                  <button key={`blocks-${type}`} type="button" role="menuitem" onClick={() => choose(() => onInsertBlock("blocks", type))}>
                    {BLOCK_LABEL[type]}
                  </button>
                ))}
                <p className="insert-label">Side</p>
                {BLOCK_KINDS.map((type) => (
                  <button key={`side-${type}`} type="button" role="menuitem" onClick={() => choose(() => onInsertBlock("side", type))}>
                    {BLOCK_LABEL[type]}
                  </button>
                ))}
                <p className="insert-label">Widgets</p>
                {WIDGET_KINDS.map((type) => (
                  <button key={type} type="button" role="menuitem" onClick={() => choose(() => onInsertWidget(type))}>
                    {WIDGET_LABEL[type]}
                  </button>
                ))}
                <button type="button" role="menuitem" disabled={!canRemove} onClick={() => choose(onRemove)}>
                  Remove
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!canRemoveSlide}
                  title={canRemoveSlide ? "Remove slide" : "The last slide cannot be removed."}
                  onClick={() => choose(onRemoveSlide)}
                >
                  Remove slide
                </button>
              </div>
            ) : null}
          </div>
          <IconButton label={pinned ? "Unpin" : "Pin"} pressed={pinned} onClick={onPin}>
            <Icon name="pin" />
          </IconButton>
          <IconButton label="Hide" onClick={onHide}>
            <Icon name="hide" />
          </IconButton>
        </div>
      </div>
      {error ? <p className="yaml-error">{error}</p> : null}
      <div ref={host} className="yaml-editor" aria-label="Deck YAML" />
      <section
        ref={sessionRef}
        className="yaml-session"
        aria-label="Session"
        data-lit={sessionLit ? "true" : undefined}
      >
        <div className="panel-head">
          <h2>Session</h2>
        </div>
        <p className="yaml-session-note">This run. Not the deck file.</p>
        <pre>{sessionText}</pre>
      </section>
    </section>
  );
}
