import type { ReactNode } from "react";
import { bindProbe, type ProbePath } from "../model/probe";
import type { Widget } from "../model/schema";
import type { WidgetAnswer } from "../model/session";
import { WidgetList } from "../widgets/WidgetControl";
import { Icon, IconButton } from "./IconButton";
import { Splitter } from "./Splitter";

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
  pinned = true,
  onPin,
  feedback = false,
  nextPreview,
  slideIndex = 0,
  probe = null,
  onProbe,
  onDecisions,
  onNotesWidth,
  onHeight,
  onAddWidget,
  onRemove,
  canRemove,
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
  pinned?: boolean;
  onPin?: () => void;
  feedback?: boolean;
  nextPreview?: ReactNode;
  slideIndex?: number;
  probe?: ProbePath | null;
  onProbe?: (path: ProbePath) => void;
  onDecisions?: (delta: number) => void;
  onNotesWidth?: (delta: number) => void;
  onHeight?: (delta: number) => void;
  onAddWidget?: (type: Widget["type"]) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}) {
  return (
    <footer className={feedback ? "bottom feedback" : pinned ? "bottom" : "bottom pane floating bottom-float"}>
      {onHeight ? <Splitter className="row" axis="y" label="Resize presenter strip" onDelta={onHeight} /> : null}
      {feedback ? null : (
        <div className="panel-actions bottom-actions">
          <IconButton label={pinned ? "Unpin" : "Pin"} pressed={pinned} onClick={onPin}>
            <Icon name="pin" />
          </IconButton>
          <IconButton label="Hide" onClick={onHide}>
            <Icon name="hide" />
          </IconButton>
        </div>
      )}
      <section className="decisions" aria-label="Decisions">
        <WidgetList
          slideId={slideId}
          slideIndex={slideIndex}
          widgets={widgets}
          answers={answers}
          onAnswer={onAnswer}
          probe={probe}
          onProbe={onProbe}
          onAdd={onAddWidget}
          onRemove={onRemove}
          canRemove={canRemove}
        />
      </section>
      {onDecisions ? <Splitter className="col" axis="x" label="Resize decisions" onDelta={onDecisions} /> : null}
      <section className="notes-col" aria-label="Notes">
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
        </div>
      </section>
      {onNotesWidth ? <Splitter className="col" axis="x" label="Resize notes" onDelta={onNotesWidth} /> : null}
      {feedback ? null : (
        <section className="next-col" aria-label="Next">
          <div className="next-preview">
            <div className="next-fit">{nextPreview}</div>
          </div>
        </section>
      )}
    </footer>
  );
}
