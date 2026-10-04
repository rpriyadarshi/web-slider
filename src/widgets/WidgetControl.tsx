import { bindProbe, type ProbePath } from "../model/probe";
import type { Widget } from "../model/schema";
import type { WidgetAnswer } from "../model/session";

export function WidgetList({
  slideId,
  slideIndex = 0,
  widgets,
  answers,
  onAnswer,
  probe = null,
  onProbe,
}: {
  slideId: string;
  slideIndex?: number;
  widgets: Widget[];
  answers: Record<string, WidgetAnswer> | undefined;
  onAnswer: (widgetId: string, answer: WidgetAnswer | undefined) => void;
  probe?: ProbePath | null;
  onProbe?: (path: ProbePath) => void;
}) {
  return (
    <div className="decision-tools">
      {widgets.length === 0 ? (
        <p className="empty-note">No decisions on this slide.</p>
      ) : (
        <div className="widget-row">
          {widgets.map((widget, index) => (
            <div key={widget.id} {...bindProbe(["slides", slideIndex, "widgets", index], probe, onProbe)}>
              <WidgetControl
                slideId={slideId}
                widget={widget}
                answer={answers?.[widget.id]}
                onAnswer={(answer) => onAnswer(widget.id, answer)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetControl({
  slideId,
  widget,
  answer,
  onAnswer,
}: {
  slideId: string;
  widget: Widget;
  answer: WidgetAnswer | undefined;
  onAnswer: (answer: WidgetAnswer | undefined) => void;
}) {
  if (widget.type === "radio" || widget.type === "checkbox") {
    const group = `${slideId}-${widget.id}`;
    return (
      <fieldset className="widget">
        <legend>{widget.prompt}</legend>
        <div className="choices">
          {widget.options.map((option) => {
            const checked =
              widget.type === "radio" ? answer === option : Array.isArray(answer) && answer.includes(option);
            return (
              <label key={option}>
                <input
                  type={widget.type === "radio" ? "radio" : "checkbox"}
                  name={group}
                  checked={checked}
                  onChange={(event) => {
                    if (widget.type === "radio") {
                      onAnswer(option);
                      return;
                    }
                    const current = Array.isArray(answer) ? answer : [];
                    onAnswer(
                      event.target.checked ? [...current, option] : current.filter((value) => value !== option),
                    );
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (widget.type === "select") {
    return (
      <label className="widget">
        <span>{widget.prompt}</span>
        <select
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onAnswer(event.target.value || undefined)}
        >
          <option value="">Choose</option>
          {widget.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (widget.type === "text") {
    return (
      <label className="widget">
        <span>{widget.prompt}</span>
        <input
          type="text"
          value={typeof answer === "string" ? answer : ""}
          onChange={(event) => onAnswer(event.target.value || undefined)}
        />
      </label>
    );
  }

  return (
    <div className="widget">
      <span id={`${slideId}-${widget.id}-scale`}>{widget.prompt}</span>
      <div className="scale" role="group" aria-labelledby={`${slideId}-${widget.id}-scale`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={answer === value}
            onClick={() => onAnswer(answer === value ? undefined : value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
