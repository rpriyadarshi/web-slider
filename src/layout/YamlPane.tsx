import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";
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
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--highlight) 35%, transparent)",
  },
});

export function YamlPane({
  value,
  error,
  pinned,
  selection,
  onChange,
  onCaret,
  onPin,
  onHide,
  className,
}: {
  value: string;
  error: string | null;
  pinned: boolean;
  selection: { start: number; end: number; token: number } | null;
  onChange: (value: string) => void;
  onCaret: (offset: number, jump: boolean) => void;
  onPin: () => void;
  onHide: () => void;
  className: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applying = useRef(false);
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
          EditorState.tabSize.of(2),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (applying.current) return;
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
            if (update.selectionSet) {
              const head = update.state.selection.main.head;
              const pointer = update.transactions.some((transaction) => transaction.isUserEvent("select.pointer"));
              onCaretRef.current(head, pointer);
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
    const view = viewRef.current;
    if (!view || !selection) return;
    const end = Math.min(selection.end, view.state.doc.length);
    const start = Math.min(selection.start, end);
    applying.current = true;
    view.dispatch({
      selection: { anchor: start, head: end },
      scrollIntoView: true,
    });
    applying.current = false;
  }, [selection?.token]);

  return (
    <section className={className} aria-label="YAML">
      <div className="panel-head">
        <IconMark label="YAML" name="yaml" />
        <div className="panel-actions">
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
    </section>
  );
}
