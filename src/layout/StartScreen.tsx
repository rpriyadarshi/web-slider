import { useState } from "react";

export function StartScreen({
  onOpenFile,
  requestOpen,
  onExample,
}: {
  onOpenFile: (file: File) => void;
  requestOpen: () => void;
  onExample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <main className="start">
      <section className="start-card">
        <p className="eyebrow">Web Slider</p>
        <h1>Present from a YAML deck.</h1>
        <p className="lede">
          Icons along the edge open the outline, examples, theme, and exports. Decisions and the notes you take
          during the talk stay in this browser until you download them.
        </p>
        <div className="start-actions">
          <button type="button" className="primary" onClick={requestOpen}>
            Open YAML
          </button>
          <button type="button" onClick={onExample}>
            Load example
          </button>
        </div>
        <div
          className={dragging ? "dropzone dragover" : "dropzone"}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) onOpenFile(file);
          }}
        >
          Drop a .yaml file or a .zip package here
        </div>
      </section>
    </main>
  );
}
