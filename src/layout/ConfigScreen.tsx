import { useRef, useState } from "react";
import { CatalogChoices } from "./CatalogChoices";

export function ConfigScreen({
  error,
  onPath,
  onSource,
  onFailure,
}: {
  error: string | null;
  onPath: (path: string) => void;
  onSource: (source: string) => void;
  onFailure: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [path, setPath] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    void file.text().then(onSource, (caught: unknown) => {
      onFailure(caught instanceof Error ? caught.message : String(caught));
    });
  }

  return (
    <main className="start" data-boot="config">
      <section className="start-card">
        <p className="eyebrow">Web Slider</p>
        <h1>{error ? "The config failed to load." : "Choose a config."}</h1>
        {error ? <pre className="error-body">{error}</pre> : null}
        <p className="lede">
          No theme is loaded until a config is supplied. Open or drop a .yaml config file, or enter a site path such as
          samples/examples/northwind/web-slider.config.yaml.
        </p>
        <CatalogChoices list="installs" label="Themes" onChoose={onPath} />
        <div className="start-actions">
          <button type="button" className="primary" onClick={() => inputRef.current?.click()}>
            Open config
          </button>
        </div>
        <form
          className="config-form"
          onSubmit={(event) => {
            event.preventDefault();
            onPath(path);
          }}
        >
          <label className="config-label" htmlFor="config-path">
            Site path
          </label>
          <div className="config-row">
            <input
              id="config-path"
              name="config"
              value={path}
              placeholder="samples/examples/northwind/web-slider.config.yaml"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setPath(event.target.value)}
            />
            <button type="submit">Load config</button>
          </div>
        </form>
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
            if (file) readFile(file);
          }}
        >
          Drop a .yaml config file here
        </div>
        <input
          ref={inputRef}
          className="file-input"
          type="file"
          accept=".yaml,.yml,text/yaml,application/yaml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) readFile(file);
          }}
        />
      </section>
    </main>
  );
}
