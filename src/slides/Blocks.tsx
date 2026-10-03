import { useEffect, useState } from "react";
import { highlightCode } from "../highlight";
import { bindProbe, type ProbePath } from "../model/probe";
import type { Block } from "../model/schema";
import { isRevealed } from "../model/steps";

export function Blocks({
  blocks,
  revealed,
  dark,
  onOpenSlide,
  onEditItem,
  skip,
  slideIndex = 0,
  probe = null,
  onProbe,
}: {
  blocks: Block[] | undefined;
  revealed: number;
  dark: boolean;
  onOpenSlide?: (slideId: string) => void;
  onEditItem?: (blockIndex: number, itemIndex: number, text: string) => void;
  skip?: Block;
  slideIndex?: number;
  probe?: ProbePath | null;
  onProbe?: (path: ProbePath) => void;
}) {
  const visible = (blocks ?? []).flatMap((block, blockIndex) =>
    block !== skip && isRevealed(block.step, revealed) ? [{ block, blockIndex }] : [],
  );
  if (visible.length === 0) return null;
  return (
    <div className="blocks">
      {visible.map(({ block, blockIndex }) => (
        <BlockView
          key={blockIndex}
          block={block}
          blockIndex={blockIndex}
          revealed={revealed}
          dark={dark}
          onOpenSlide={onOpenSlide}
          onEditItem={onEditItem}
          slideIndex={slideIndex}
          probe={probe}
          onProbe={onProbe}
        />
      ))}
    </div>
  );
}

function BlockView({
  block,
  blockIndex,
  revealed,
  dark,
  onOpenSlide,
  onEditItem,
  slideIndex,
  probe,
  onProbe,
}: {
  block: Block;
  blockIndex: number;
  revealed: number;
  dark: boolean;
  onOpenSlide?: (slideId: string) => void;
  onEditItem?: (blockIndex: number, itemIndex: number, text: string) => void;
  slideIndex: number;
  probe: ProbePath | null;
  onProbe?: (path: ProbePath) => void;
}) {
  const blockPath: ProbePath = ["slides", slideIndex, "blocks", blockIndex];
  if (block.type === "paragraph") {
    return (
      <p className="block paragraph" {...bindProbe(blockPath, probe, onProbe)}>
        {block.text}
      </p>
    );
  }
  if (block.type === "bullets" || block.type === "numbered") {
    const items = block.items.filter((item) => isRevealed(item.step, revealed));
    if (items.length === 0) return null;
    const List = block.type === "numbered" ? "ol" : "ul";
    return (
      <List className={block.type === "numbered" ? "block numbered" : "block bullets"} {...bindProbe(blockPath, probe, onProbe)}>
        {block.items.map((item, itemIndex) =>
          isRevealed(item.step, revealed) ? (
            <li key={`${item.text}-${itemIndex}`} {...bindProbe([...blockPath, "items", itemIndex], probe, onProbe)}>
              <EditableText
                text={item.text}
                onSelect={onProbe ? () => onProbe([...blockPath, "items", itemIndex]) : undefined}
                onCommit={onEditItem ? (value) => onEditItem(blockIndex, itemIndex, value) : undefined}
              />
            </li>
          ) : null,
        )}
      </List>
    );
  }
  if (block.type === "table") {
    return (
      <table className="block data-table" {...bindProbe(blockPath, probe, onProbe)}>
        <thead>
          <tr>
            {block.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (block.type === "link") {
    return (
      <div {...bindProbe(blockPath, probe, onProbe)}>
        {block.slide ? (
          <button type="button" className="block slide-link" onClick={() => onOpenSlide?.(block.slide!)}>
            {block.text}
          </button>
        ) : (
          <a className="block slide-link" href={block.href} target="_blank" rel="noreferrer">
            {block.text}
          </a>
        )}
      </div>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote className="block quote" {...bindProbe(blockPath, probe, onProbe)}>
        <p>{block.text}</p>
        {block.attribution ? <footer>{block.attribution}</footer> : null}
      </blockquote>
    );
  }
  if (block.type === "callout") {
    return (
      <aside className="block callout" {...bindProbe(blockPath, probe, onProbe)}>
        {block.text}
      </aside>
    );
  }
  if (block.type === "divider") return <hr className="block divider" {...bindProbe(blockPath, probe, onProbe)} />;
  if (block.type === "video") {
    return (
      <figure className="block figure" {...bindProbe(blockPath, probe, onProbe)}>
        <video controls src={block.src} title={block.title} />
        {block.title ? <figcaption>{block.title}</figcaption> : null}
      </figure>
    );
  }
  if (block.type === "chart") {
    return (
      <div {...bindProbe(blockPath, probe, onProbe)}>
        <ChartBlock kind={block.kind} labels={block.labels} values={block.values} />
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <figure className="block figure" {...bindProbe(blockPath, probe, onProbe)}>
        <img src={block.src} alt={block.alt ?? ""} />
        {block.alt ? <figcaption>{block.alt}</figcaption> : null}
      </figure>
    );
  }
  return (
    <div {...bindProbe(blockPath, probe, onProbe)}>
      <CodeBlock code={block.code} language={block.language} dark={dark} />
    </div>
  );
}

function ChartBlock({ kind, labels, values }: { kind: "bar" | "column"; labels: string[]; values: number[] }) {
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const width = 320;
  const height = 180;
  if (kind === "column") {
    const slot = (width - 24) / values.length;
    const plotTop = 12;
    const plotHeight = 128;
    const zero = plotTop + ((max - 0) / span) * plotHeight;
    return (
      <svg className="block chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Column chart">
        {values.map((value, index) => {
          const barHeight = (Math.abs(value) / span) * plotHeight;
          const x = 12 + index * slot + slot * 0.18;
          const y = value >= 0 ? zero - barHeight : zero;
          return <rect key={labels[index]} x={x} y={y} width={slot * 0.64} height={Math.max(barHeight, 0)} />;
        })}
        {labels.map((label, index) => (
          <text key={label} x={12 + index * slot + slot / 2} y={height - 8} textAnchor="middle">
            {label}
          </text>
        ))}
      </svg>
    );
  }
  const slot = (height - 16) / values.length;
  const plotWidth = 220;
  const zero = 88 + ((0 - min) / span) * plotWidth;
  return (
    <svg className="block chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Bar chart">
      {values.map((value, index) => {
        const barWidth = (Math.abs(value) / span) * plotWidth;
        const y = 8 + index * slot + slot * 0.2;
        const x = value >= 0 ? zero : zero - barWidth;
        return <rect key={labels[index]} x={x} y={y} width={Math.max(barWidth, 0)} height={slot * 0.6} />;
      })}
      {labels.map((label, index) => (
        <text key={label} x={4} y={8 + index * slot + slot * 0.62}>
          {label}
        </text>
      ))}
    </svg>
  );
}

export function EditableText({
  text,
  onCommit,
  onSelect,
  className,
}: {
  text: string;
  onCommit?: (text: string) => void;
  onSelect?: () => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  if (!onCommit) return <span className={className}>{text}</span>;
  if (!editing) {
    return (
      <button
        type="button"
        className={className ? `text-edit ${className}` : "text-edit"}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
      >
        {text}
      </button>
    );
  }
  return (
    <input
      className="text-edit"
      value={draft}
      aria-label="Edit text"
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft.trim() !== text) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(text);
          setEditing(false);
        }
      }}
    />
  );
}

function CodeBlock({ code, language, dark }: { code: string; language?: string; dark: boolean }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, language, dark).then(
      (value) => {
        if (!cancelled) {
          setHtml(value);
          setError(null);
        }
      },
      (reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, language, dark]);

  if (error) {
    return (
      <div className="block code-error">
        <p>{error}</p>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }
  if (!html) {
    return (
      <pre className="block code">
        <code>{code}</code>
      </pre>
    );
  }
  return <div className="block code" dangerouslySetInnerHTML={{ __html: html }} />;
}
