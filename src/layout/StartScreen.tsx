import { useState } from "react";
import { BrandLockup, resolveBrand, resolveChrome, withAssetUrls } from "../brand/kit";
import type { Install } from "../model/install";

export function StartScreen({
  install,
  onOpenFile,
  requestOpen,
  onExample,
}: {
  install: Install;
  onOpenFile: (file: File) => void;
  requestOpen: () => void;
  onExample: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const brand = withAssetUrls(resolveBrand(install.manifest.brand), install.assetUrls);
  const mode = install.manifest.theme.chrome === "light" ? "light" : "dark";
  const palette = resolveChrome(install.manifest.theme, mode, brand);
  return (
    <main
      className="start"
      data-manifest={install.manifestPath}
      style={{
        ["--ground" as string]: palette.ground,
        ["--paper" as string]: palette.paper,
        ["--text" as string]: palette.text,
        ["--muted" as string]: palette.muted,
        ["--line" as string]: palette.line,
        ["--accent" as string]: palette.accent,
        ["--highlight" as string]: palette.highlight,
      }}
    >
      <section className="start-card">
        {brand ? <BrandLockup brand={brand} mode={mode} /> : null}
        <p className="eyebrow">Web Slider</p>
        <h1>Present from a YAML deck.</h1>
        <p className="lede">
          This install loads {install.manifestPath}. Icons along the edge open the outline, examples, theme, and
          exports. Decisions and the notes you take during the talk stay in this browser until you download them.
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
