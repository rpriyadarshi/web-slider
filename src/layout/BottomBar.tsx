import type { ReactNode } from "react";
import { bindProbe, type ProbePath } from "../model/probe";
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
  onNotesFocus,
  onHide,
  feedback = false,
  nextPreview,
  slideIndex = 0,
  probe = null,
  onProbe,
}: {
  slideId: string;
  widgets: Widget[];
  answers: Record<string, WidgetAnswer> | undefined;
  script: string | undefined;
  notes: string;
  onAnswer: (widgetId: string, answer: WidgetAnswer | undefined) => void;
  onNotes: (value: string) => void;
  onNotesFocus?: () => void;
  onHide: () => void;
  feedback?: boolean;
  nextPreview?: ReactNode;
  slideIndex?: number;
  probe?: ProbePath | null;
  onProbe?: (path: ProbePath) => void;
}) {
  return (
    <footer className="bottom">
      <section className="decisions" aria-label="Decisions">
        <div className="panel-head">
          <IconMark label="Decisions" name="examples" />
        </div>
        <WidgetList
          slideId={slideId}
          slideIndex={slideIndex}
          widgets={widgets}
          answers={answers}
          onAnswer={onAnswer}
          probe={probe}
          onProbe={onProbe}
        />
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
            <p {...bindProbe(["slides", slideIndex, "notes"], probe, onProbe)}>
              {script?.trim() ? script : "No script for this slide."}
            </p>
          </div>
          <label className="taken">
            {feedback ? "Feedback" : "Taken notes"}
            <textarea
              value={notes}
              onFocus={() => onNotesFocus?.()}
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
