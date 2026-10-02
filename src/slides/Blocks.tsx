import { useEffect, useState } from "react";
import { highlightCode } from "../highlight";
import type { Block } from "../model/schema";
import { isRevealed } from "../model/steps";

export function Blocks({
  blocks,
  revealed,
  dark,
}: {
  blocks: Block[] | undefined;
  revealed: number;
  dark: boolean;
}) {
  const visible = (blocks ?? []).filter((block) => isRevealed(block.step, revealed));
  if (visible.length === 0) return null;
  return (
    <div className="blocks">
      {visible.map((block, index) => (
        <BlockView key={index} block={block} revealed={revealed} dark={dark} />
      ))}
    </div>
  );
}

function BlockView({ block, revealed, dark }: { block: Block; revealed: number; dark: boolean }) {
  if (block.type === "paragraph") return <p className="block paragraph">{block.text}</p>;
  if (block.type === "bullets") {
    const items = block.items.filter((item) => isRevealed(item.step, revealed));
    if (items.length === 0) return null;
    return (
      <ul className="block bullets">
        {items.map((item, index) => (
          <li key={`${item.text}-${index}`}>{item.text}</li>
        ))}
      </ul>
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
