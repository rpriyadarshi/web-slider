import { useEffect, useRef } from "react";
import { Icon, IconButton, IconMark } from "./IconButton";

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
  const editor = useRef<HTMLTextAreaElement>(null);
  const applying = useRef(false);

  useEffect(() => {
    const element = editor.current;
    if (!element || !selection) return;
    applying.current = true;
    element.setSelectionRange(selection.start, selection.end);
    const line = value.slice(0, selection.start).split("\n").length;
    element.scrollTop = Math.max(0, line * 18 - element.clientHeight / 3);
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
      <textarea
        ref={editor}
        className="yaml-editor"
        spellCheck={false}
        aria-label="Deck YAML"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onMouseUp={(event) => {
          if (applying.current) return;
          onCaret(event.currentTarget.selectionStart, true);
        }}
        onKeyUp={(event) => {
          if (applying.current) return;
          if (event.key === "Shift" || event.key === "Alt" || event.key === "Control" || event.key === "Meta") return;
          onCaret(event.currentTarget.selectionStart, false);
        }}
      />
    </section>
  );
}
