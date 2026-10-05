import { useState, type ReactNode } from "react";
import { shareBuild } from "../model/build";
import { helpContext } from "../help/context";
import { CONTROL_GROUPS, CONTROLS } from "../help/controls";
import { SHORTCUTS, editorKeys, shortcutCaps } from "../help/keys";
import { fieldText, TALK, type FieldDoc } from "../help/reference";
import { TOPICS } from "../help/topics";
import type { Deck } from "../model/schema";
import type { ProbePath } from "../model/probe";
import { Icon, IconButton, IconMark } from "./IconButton";
import { Keys } from "./Tooltip";
import { hideTip, pinTip } from "../help/tips";

export function HelpPane({
  deck,
  slideIndex,
  probe,
  yamlError,
  blank,
  laserOn,
  captionsOn,
  captionError,
  pinned,
  onPin,
  onHide,
  className,
}: {
  deck: Deck;
  slideIndex: number;
  probe: ProbePath | null;
  yamlError: string | null;
  blank: "black" | "white" | null;
  laserOn: boolean;
  captionsOn: boolean;
  captionError: string | null;
  pinned: boolean;
  onPin: () => void;
  onHide: () => void;
  className: string;
}) {
  const [query, setQuery] = useState("");
  const focus = helpContext(deck, probe, slideIndex);
  const q = query.trim().toLowerCase();
  const show = (parts: Array<string | undefined | readonly string[]>) => {
    if (!q) return true;
    return parts
      .flatMap((part) => (typeof part === "string" ? [part] : part ? [...part] : []))
      .join("\n")
      .toLowerCase()
      .includes(q);
  };
  const focusMatch = show([focus.title, focus.about, focus.facts, focus.example, ...focus.fields.flatMap(fieldBlob)]);
  const statuses = statusLines({ yamlError, blank, laserOn, captionsOn, captionError });
  let any = focusMatch || statuses.some((line) => show([line.title, line.body]));
  for (const topic of TOPICS) if (show([topic.title, topic.paragraphs])) any = true;
  for (const row of SHORTCUTS) if (show([row.about, row.caps])) any = true;
  for (const row of editorKeys()) if (show([row.about, row.caps])) any = true;
  for (const item of CONTROLS) {
    if (item.shareHidden && shareBuild) continue;
    if (show([item.label, item.about])) any = true;
  }
  for (const field of TALK.deck) if (show(fieldBlob(field))) any = true;
  for (const field of TALK.slide) if (show(fieldBlob(field))) any = true;
  for (const kind of [...TALK.blocks, ...TALK.widgets]) if (show([kind.label, kind.about, kind.example, ...kind.fields.flatMap(fieldBlob)])) any = true;

  const searching = q.length > 0;

  return (
    <section className={className} aria-label="Help">
      <div className="panel-head">
        <IconMark label="Help" name="help" tip="This guide. It follows the slide, block, or question you select." />
        <div className="panel-actions">
          <IconButton label={pinned ? "Unpin" : "Pin"} tip={pinTip(pinned, "Help")} pressed={pinned} onClick={onPin}>
            <Icon name="pin" />
          </IconButton>
          <IconButton label="Hide" tip={hideTip("Help")} onClick={onHide}>
            <Icon name="hide" />
          </IconButton>
        </div>
      </div>
      <label className="help-search">
        <input
          value={query}
          placeholder="Search help"
          aria-label="Search help"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="help-body">
        {yamlError ? (
          <section className="help-card">
            <h2>The YAML does not parse</h2>
            <p>The last valid slide stays on screen. Insert and remove wait until the file parses.</p>
            <pre className="yaml-error">{yamlError}</pre>
          </section>
        ) : null}
        {statuses
          .filter((line) => line.id !== "yaml")
          .map((line) => (
            <section key={line.id} className="help-card">
              <h2>{line.title}</h2>
              <p>{line.body}</p>
            </section>
          ))}
        {focusMatch ? (
          <section className="help-card">
            <h2>{focus.title}</h2>
            <p>{focus.about}</p>
            {focus.facts.length > 0 ? (
              <ul>
                {focus.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            ) : null}
            {focus.fields.length > 0 ? (
              <ul className="help-fields">
                {focus.fields.map((field) => (
                  <FieldLine key={field.name} field={field} />
                ))}
              </ul>
            ) : null}
            {focus.example ? <pre className="help-example">{focus.example}</pre> : null}
          </section>
        ) : null}

        {TOPICS.map((topic) => {
          const match = show([topic.title, topic.paragraphs]);
          if (!match) return null;
          return (
            <Disclosure key={topic.id} title={topic.title} forceOpen={searching} startOpen={topic.id === "start"}>
              {topic.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Disclosure>
          );
        })}

        {show(["Keyboard", ...SHORTCUTS.flatMap((row) => [row.about, ...row.caps]), ...editorKeys().flatMap((row) => [row.about, ...row.caps])]) ? (
          <Disclosure title="Keyboard" forceOpen={searching}>
            <h3>While presenting</h3>
            <ul className="help-keys">
              {SHORTCUTS.filter((row) => show([row.about, row.caps])).map((row) => (
                <li key={row.id}>
                  <Keys caps={row.caps} />
                  <span>{row.about}</span>
                </li>
              ))}
            </ul>
            <h3>In the YAML pane</h3>
            <ul className="help-keys">
              {editorKeys()
                .filter((row) => show([row.about, row.caps]))
                .map((row) => (
                  <li key={row.caps.join("-")}>
                    <Keys caps={row.caps} />
                    <span>{row.about}</span>
                  </li>
                ))}
            </ul>
          </Disclosure>
        ) : null}

        {CONTROL_GROUPS.map((group) => {
          const items = CONTROLS.filter((item) => item.group === group.id && !(item.shareHidden && shareBuild) && show([item.label, item.about, item.shortcut ? [...shortcutCaps(item.shortcut)] : []]));
          if (items.length === 0) return null;
          return (
            <Disclosure key={group.id} title={group.title} forceOpen={searching}>
              <ul className="help-controls">
                {items.map((item) => (
                  <li key={item.id}>
                    {item.icon ? <Icon name={item.icon} /> : null}
                    <span>
                      <strong>{item.label}</strong>
                      {item.shortcut ? <Keys caps={shortcutCaps(item.shortcut)} /> : null}
                      <p>{item.about}</p>
                    </span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          );
        })}

        <Reference title="Deck fields" fields={TALK.deck.filter((field) => show(fieldBlob(field)))} forceOpen={searching} />
        <Reference title="Slide fields" fields={TALK.slide.filter((field) => show(fieldBlob(field)))} forceOpen={searching} />
        {[...TALK.blocks, ...TALK.widgets].map((kind) => {
          const match = show([kind.label, kind.about, kind.example, ...kind.fields.flatMap(fieldBlob)]);
          if (!match) return null;
          return (
            <Disclosure key={`${kind.group}-${kind.type}`} title={kind.label} forceOpen={searching}>
              <p>{kind.about}</p>
              <ul className="help-fields">
                {kind.fields.map((field) => (
                  <FieldLine key={field.name} field={field} />
                ))}
              </ul>
              <pre className="help-example">{kind.example}</pre>
            </Disclosure>
          );
        })}
        {!any && q ? <p className="help-miss">Nothing in the help matches.</p> : null}
      </div>
    </section>
  );
}

function Disclosure({
  title,
  forceOpen,
  startOpen = false,
  children,
}: {
  title: string;
  forceOpen: boolean;
  startOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details key={forceOpen ? "search" : "browse"} {...(forceOpen ? { open: true } : { defaultOpen: startOpen })}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

function Reference({ title, fields, forceOpen }: { title: string; fields: readonly FieldDoc[]; forceOpen: boolean }) {
  if (fields.length === 0) return null;
  return (
    <Disclosure title={title} forceOpen={forceOpen}>
      <ul className="help-fields">
        {fields.map((field) => (
          <FieldLine key={field.name} field={field} />
        ))}
      </ul>
    </Disclosure>
  );
}

function FieldLine({ field }: { field: FieldDoc }) {
  return (
    <li>
      <code>{field.name}</code> {fieldText(field)}
      {field.fields && field.fields.length > 0 ? (
        <ul>
          {field.fields.map((child) => (
            <FieldLine key={child.name} field={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function fieldBlob(field: FieldDoc): string[] {
  return [field.name, field.about, ...(field.values ?? []), ...(field.fields?.flatMap(fieldBlob) ?? [])];
}

function statusLines({
  yamlError,
  blank,
  laserOn,
  captionsOn,
  captionError,
}: {
  yamlError: string | null;
  blank: "black" | "white" | null;
  laserOn: boolean;
  captionsOn: boolean;
  captionError: string | null;
}): { id: string; title: string; body: string }[] {
  const lines: { id: string; title: string; body: string }[] = [];
  if (yamlError) lines.push({ id: "yaml", title: "The YAML does not parse", body: yamlError });
  if (blank) lines.push({ id: "blank", title: `Audience is ${blank}`, body: `Any other key brings the slide back and does not move.` });
  if (laserOn) lines.push({ id: "laser", title: "Laser is on", body: "Move over the slide. The audience window follows." });
  if (captionsOn) lines.push({ id: "captions", title: "Captions are on", body: "They follow your voice and show on the audience window." });
  if (captionError) lines.push({ id: "caption-error", title: "Captions stopped", body: captionError });
  return lines;
}
