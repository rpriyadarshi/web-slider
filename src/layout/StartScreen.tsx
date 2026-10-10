import { useState } from "react";
import { BrandLockup, resolveBrand, resolveChrome, withAssetUrls } from "../brand/kit";
import { shareBuild } from "../model/build";
import type { Install } from "../model/install";
import { loadRecent } from "../session/recent";
import { CatalogChoices } from "./CatalogChoices";

export function StartScreen({
  install,
  onOpenFile,
  requestOpen,
  onBlank,
  onShipped,
  onExample,
  onContinue,
  continueTitle,
}: {
  install: Install;
  onOpenFile: (file: File) => void;
  requestOpen: () => void;
  onBlank: () => void;
  onShipped?: () => void;
  onExample: (path: string) => void;
  onContinue?: () => void;
  continueTitle?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const recent = loadRecent();
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
          This install loads {install.manifestPath}. Open a sample or a file to start. From a talk, Home returns here.
          The toolbar opens the outline, examples, the YAML file, presenter notes, the theme, export, and help.
        </p>
        <div className="start-actions">
          {onContinue ? (
            <button type="button" className="primary" onClick={onContinue}>
              Continue{continueTitle ? `: ${continueTitle}` : ""}
            </button>
          ) : (
            <button type="button" className="primary" onClick={requestOpen}>
              Open YAML
            </button>
          )}
          {onContinue ? (
            <button type="button" onClick={requestOpen}>
              Open YAML
            </button>
          ) : null}
          <button type="button" onClick={onBlank}>
            Blank deck
          </button>
          {onShipped ? (
            <button type="button" onClick={onShipped}>
              Shipped talk
            </button>
          ) : null}
        </div>
        {shareBuild ? null : <CatalogChoices list="examples" label="Examples" onChoose={onExample} />}
        {shareBuild || recent.length === 0 ? null : (
          <div className="sample-block">
            <p className="sample-label">Recent</p>
            <div className="sample-list">
              {recent.map((entry) => (
                <button key={entry.path} type="button" onClick={() => onExample(entry.path)}>
                  {entry.title}
                </button>
              ))}
            </div>
          </div>
        )}
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
          Drop a .yaml file, a .zip package, or a .pptx file here
        </div>
      </section>
    </main>
  );
}
