import type { ReactNode } from "react";
import type { Widget } from "../model/schema";
import type { WidgetAnswer } from "../model/session";
import { WidgetList } from "../widgets/WidgetControl";
import { Icon, IconButton, IconMark } from "./IconButton";

export function BottomBar({
  slideId,
  widgets,
  answers,
  script,
  notes,
  onAnswer,
  onNotes,
  onHide,
  feedback = false,
  nextPreview,
}: {
  slideId: string;
  widgets: Widget[];
  answers: Record<string, WidgetAnswer> | undefined;
  script: string | undefined;
  notes: string;
  onAnswer: (widgetId: string, answer: WidgetAnswer | undefined) => void;
  onNotes: (value: string) => void;
  onHide: () => void;
  feedback?: boolean;
  nextPreview?: ReactNode;
}) {
  return (
    <footer className="bottom">
      <section className="decisions" aria-label="Decisions">
        <div className="panel-head">
          <IconMark label="Decisions" name="examples" />
        </div>
        <WidgetList slideId={slideId} widgets={widgets} answers={answers} onAnswer={onAnswer} />
      </section>
      <section className="notes-col" aria-label="Notes">
        <div className="panel-head">
          <IconMark label={feedback ? "Feedback" : "Notes"} name="notes" />
          {feedback ? null : (
            <div className="panel-actions">
              <IconButton label="Hide" onClick={onHide}>
                <Icon name="hide" />
              </IconButton>
            </div>
          )}
        </div>
        <div className="notes-grid">
          <div className="script">
            <h3>Script</h3>
            <p>{script?.trim() ? script : "No script for this slide."}</p>
          </div>
          <label className="taken">
            {feedback ? "Feedback" : "Taken notes"}
            <textarea
              value={notes}
              onChange={(event) => onNotes(event.target.value)}
              placeholder={feedback ? "Tell the presenter what you think" : "Notes you take during the talk"}
            />
          </label>
          {nextPreview ? <div className="next-preview">{nextPreview}</div> : null}
        </div>
      </section>
    </footer>
  );
}
