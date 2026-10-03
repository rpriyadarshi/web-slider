import { useEffect, useState } from "react";
import { highlightCode } from "../highlight";
import type { Block } from "../model/schema";
import { isRevealed } from "../model/steps";

export function Blocks({
  blocks,
  revealed,
  dark,
  onOpenSlide,
}: {
  blocks: Block[] | undefined;
  revealed: number;
  dark: boolean;
  onOpenSlide?: (slideId: string) => void;
}) {
  const visible = (blocks ?? []).filter((block) => isRevealed(block.step, revealed));
  if (visible.length === 0) return null;
  return (
    <div className="blocks">
      {visible.map((block, index) => (
        <BlockView key={index} block={block} revealed={revealed} dark={dark} onOpenSlide={onOpenSlide} />
      ))}
    </div>
  );
}

function BlockView({
  block,
  revealed,
  dark,
  onOpenSlide,
}: {
  block: Block;
  revealed: number;
  dark: boolean;
  onOpenSlide?: (slideId: string) => void;
}) {
  if (block.type === "paragraph") return <p className="block paragraph">{block.text}</p>;
  if (block.type === "bullets" || block.type === "numbered") {
    const items = block.items.filter((item) => isRevealed(item.step, revealed));
    if (items.length === 0) return null;
    const List = block.type === "numbered" ? "ol" : "ul";
    return (
      <List className={block.type === "numbered" ? "block numbered" : "block bullets"}>
        {items.map((item, index) => (
          <li key={`${item.text}-${index}`}>{item.text}</li>
        ))}
      </List>
    );
  }
  if (block.type === "table") {
    return (
      <table className="block data-table">
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
    if (block.slide) {
      return (
        <button type="button" className="block slide-link" onClick={() => onOpenSlide?.(block.slide!)}>
          {block.text}
        </button>
      );
    }
    return (
      <a className="block slide-link" href={block.href} target="_blank" rel="noreferrer">
        {block.text}
      </a>
    );
  }
  if (block.type === "quote") {
    return (
      <blockquote className="block quote">
        <p>{block.text}</p>
        {block.attribution ? <footer>{block.attribution}</footer> : null}
      </blockquote>
    );
  }
  if (block.type === "callout") return <aside className="block callout">{block.text}</aside>;
  if (block.type === "divider") return <hr className="block divider" />;
  if (block.type === "video") {
    return (
      <figure className="block figure">
        <video controls src={block.src} title={block.title} />
        {block.title ? <figcaption>{block.title}</figcaption> : null}
      </figure>
    );
  }
  if (block.type === "chart") return <ChartBlock kind={block.kind} labels={block.labels} values={block.values} />;
  if (block.type === "image") {
    return (
      <figure className="block figure">
        <img src={block.src} alt={block.alt ?? ""} />
        {block.alt ? <figcaption>{block.alt}</figcaption> : null}
      </figure>
    );
  }
  return <CodeBlock code={block.code} language={block.language} dark={dark} />;
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
