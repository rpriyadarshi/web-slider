import { useEffect, useRef, useState, type ReactNode } from "react";
import { BrandLockup, resolveBrand, resolveChrome, type ChromeMode, withAssetUrls } from "../brand/kit";
import { shareBuild } from "../model/build";
import { pathFromFileUrl, type Install } from "../model/install";
import { loadRecent } from "../session/recent";
import { CatalogChoices } from "./CatalogChoices";
import { Icon, IconButton, tipProps } from "./IconButton";
import { TooltipLayer } from "./Tooltip";

const CHROME_KEY = "web-slider-chrome";

function storedMode(): ChromeMode | null {
  try {
    const value = localStorage.getItem(CHROME_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function StartScreen({
  install,
  themeError,
  deckError,
  configError,
  onThemeFile,
  onThemePath,
  onDeckFile,
  onDeckPath,
  onConfigFile,
  onConfigPath,
  onBlank,
  onShipped,
  onContinue,
  continueTitle,
}: {
  install: Install | null;
  themeError: string | null;
  deckError: string | null;
  configError: string | null;
  onThemeFile: (file: File) => void;
  onThemePath: (path: string) => void;
  onDeckFile: (file: File) => void;
  onDeckPath: (path: string) => void;
  onConfigFile: (file: File) => void;
  onConfigPath: (path: string) => void;
  onBlank: () => void;
  onShipped?: () => void;
  onContinue?: () => void;
  continueTitle?: string;
}) {
  const themeInput = useRef<HTMLInputElement>(null);
  const deckInput = useRef<HTMLInputElement>(null);
  const configInput = useRef<HTMLInputElement>(null);
  const [themePath, setThemePath] = useState("");
  const [configPath, setConfigPath] = useState("");
  const savedMode = useRef(storedMode());
  const [mode, setMode] = useState<ChromeMode>(savedMode.current ?? (install?.manifest.theme.chrome === "light" ? "light" : "dark"));
  useEffect(() => {
    if (savedMode.current) return;
    setMode(install?.manifest.theme.chrome === "light" ? "light" : "dark");
  }, [install]);
  const brand = install ? withAssetUrls(resolveBrand(install.manifest.brand), install.assetUrls) : null;
  const palette = resolveChrome(
    install?.manifest.theme ?? { accent: "#3db892", highlight: "#e4b84a" },
    mode,
    brand,
  );
  const recent = loadRecent();
  const themeName =
    brand?.wordmark ?? (install ? install.manifestPath : "No theme loaded");

  function chooseMode(next: ChromeMode) {
    savedMode.current = next;
    setMode(next);
    try {
      localStorage.setItem(CHROME_KEY, next);
    } catch {
      // The choice still applies for this view.
    }
  }

  return (
    <main
      className="start"
      data-manifest={install?.manifestPath}
      style={{
        colorScheme: mode,
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
        <div className="home-head">
          <div>
            <p className="eyebrow">Web Slider</p>
            <h1>Home</h1>
          </div>
          <div className="home-chrome" role="group" aria-label="Appearance">
            <IconButton
              label="Light"
              tip="Use the light page. This does not edit the theme file."
              pressed={mode === "light"}
              onClick={() => chooseMode("light")}
            >
              <Icon name="light" />
            </IconButton>
            <IconButton
              label="Dark"
              tip="Use the dark page. This does not edit the theme file."
              pressed={mode === "dark"}
              onClick={() => chooseMode("dark")}
            >
              <Icon name="dark" />
            </IconButton>
          </div>
        </div>
        <p className="lede" {...tipProps("Home", "Load a theme and a presentation separately. A config file names both.")}>
          Load a theme and a presentation separately. A config file is the shortcut that names both.
        </p>
        <div className="home-grid">
          <HomePane
            title="Theme"
            titleTip="The look: mark, colors, and type. Files named inside the theme are read from its directory."
            status={install ? themeName : "No theme loaded."}
            statusTip={install ? install.manifestPath : "No theme file is loaded."}
            error={themeError}
            action="Load theme"
            actionTip="Open a theme manifest or a config. The dialog keeps the file's path."
            onAction={() => void pickThen("yaml", onThemePath)}
            dropLabel="Drop a theme manifest, or a config that names one"
            dropTip="Drop a manifest or a config. The drop keeps the file's path."
            onFile={onThemeFile}
            onPath={onThemePath}
          >
            {shareBuild ? null : <CatalogChoices list="installs" label="Themes" onChoose={onThemePath} />}
            <PathForm
              id="theme-path"
              label="Path"
              value={themePath}
              placeholder="/path/to/manifest.yaml"
              button="Load theme"
              emptyTip="Type the path of a theme manifest or a config."
              onChange={setThemePath}
              onSubmit={onThemePath}
            />
          </HomePane>
          <HomePane
            title="Presentation"
            titleTip="The talk. Pictures named in a YAML talk are read from that talk's directory."
            status={continueTitle ? continueTitle : "No presentation loaded."}
            statusTip={continueTitle ? `Open now: ${continueTitle}` : "No presentation is open."}
            error={deckError}
            action="Load presentation"
            actionTip="Open a YAML talk, a zip package, or a PowerPoint file. The dialog keeps the file's path."
            primary
            onAction={() => void pickThen("talk", onDeckPath)}
            dropLabel="Drop a .yaml talk, a .zip package, or a .pptx file"
            dropTip="Drop a talk. The drop keeps the file's path."
            onFile={onDeckFile}
            onPath={onDeckPath}
          >
            <div className="start-actions">
              {onContinue ? (
                <button type="button" className="primary" {...tipProps("Continue", `Return to ${continueTitle}.`)} onClick={onContinue}>
                  Continue
                </button>
              ) : null}
              <button type="button" {...tipProps("Blank deck", "Start from one untitled slide. The loaded theme stays.")} onClick={onBlank}>
                Blank deck
              </button>
              {onShipped ? (
                <button type="button" {...tipProps("Shipped talk", install?.deckPath ?? "The talk named by the loaded config.")} onClick={onShipped}>
                  Shipped talk
                </button>
              ) : null}
            </div>
            {shareBuild ? null : <CatalogChoices list="examples" label="Examples" onChoose={onDeckPath} />}
            {shareBuild || recent.length === 0 ? null : (
              <div className="sample-block">
                <p className="sample-label" {...tipProps("Recent", "Talks opened from Home. The tip shows the file.")}>
                  Recent
                </p>
                <div className="sample-list">
                  {recent.map((entry) => (
                    <button key={entry.path} type="button" {...tipProps(entry.title, entry.path)} onClick={() => onDeckPath(entry.path)}>
                      {entry.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </HomePane>
          <HomePane
            title="Config"
            titleTip="Names a theme and, when it includes one, a talk. Both are read from the config's directory."
            status="Names a theme and, when it includes one, a talk."
            statusTip="A config is the shortcut. Loading a theme or a presentation does not require one."
            error={configError}
            action="Load config"
            actionTip="Open a config file. The dialog keeps its path."
            onAction={() => void pickThen("yaml", onConfigPath)}
            dropLabel="Drop a .yaml config file"
            dropTip="Drop a config. The drop keeps the file's path."
            onFile={onConfigFile}
            onPath={onConfigPath}
            wide
          >
            <PathForm
              id="config-path"
              label="Path"
              value={configPath}
              placeholder="/path/to/web-slider.config.yaml"
              button="Load config"
              emptyTip="Type the path of a config file."
              onChange={setConfigPath}
              onSubmit={onConfigPath}
            />
          </HomePane>
        </div>
        <input
          ref={themeInput}
          className="file-input"
          type="file"
          accept=".yaml,.yml,text/yaml,application/yaml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onThemeFile(file);
          }}
        />
        <input
          ref={deckInput}
          className="file-input"
          type="file"
          accept=".yaml,.yml,.zip,.pptx,text/yaml,application/yaml,application/zip,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onDeckFile(file);
          }}
        />
        <input
          ref={configInput}
          className="file-input"
          type="file"
          accept=".yaml,.yml,text/yaml,application/yaml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onConfigFile(file);
          }}
        />
      </section>
      <TooltipLayer />
    </main>
  );
}

async function pickThen(kind: "yaml" | "talk", onPath: (path: string) => void) {
  const response = await fetch(`/__slider/pick?kind=${kind}`);
  if (response.status === 204 || !response.ok) return;
  const body = (await response.json()) as { path?: unknown };
  if (typeof body.path === "string" && body.path.startsWith("/")) onPath(body.path);
}

function PathForm({
  id,
  label,
  value,
  placeholder,
  button,
  emptyTip,
  onChange,
  onSubmit,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  button: string;
  emptyTip: string;
  onChange: (value: string) => void;
  onSubmit: (path: string) => void;
}) {
  const file = value.trim();
  return (
    <form
      className="config-form"
      onSubmit={(event) => {
        event.preventDefault();
        const path = value.trim();
        if (path) onSubmit(path);
      }}
    >
      <label className="config-label" htmlFor={id} {...tipProps(label, file || emptyTip)}>
        {label}
      </label>
      <div className="config-row">
        <input
          id={id}
          name={id}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          {...tipProps(file || label, file || emptyTip)}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="submit" {...tipProps(button, file || emptyTip)}>
          {button}
        </button>
      </div>
    </form>
  );
}

function HomePane({
  title,
  titleTip,
  status,
  statusTip,
  error,
  action,
  actionTip,
  primary,
  onAction,
  dropLabel,
  dropTip,
  onFile,
  onPath,
  wide,
  children,
}: {
  title: string;
  titleTip: string;
  status: string;
  statusTip: string;
  error: string | null;
  action: string;
  actionTip: string;
  primary?: boolean;
  onAction: () => void;
  dropLabel: string;
  dropTip: string;
  onFile: (file: File) => void;
  onPath: (path: string) => void;
  wide?: boolean;
  children?: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <section className={wide ? "home-pane home-pane-wide" : "home-pane"}>
      <h2 {...tipProps(title, titleTip)}>{title}</h2>
      <p className="home-status" {...tipProps(status, statusTip)}>
        {status}
      </p>
      {error ? <pre className="error-body">{error}</pre> : null}
      <div className="start-actions">
        <button type="button" className={primary ? "primary" : undefined} {...tipProps(action, actionTip)} onClick={onAction}>
          {action}
        </button>
      </div>
      {children}
      <div
        {...tipProps(dropLabel, dropTip)}
        className={dragging ? "dropzone dragover" : "dropzone"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const listed = pathFromFileUrl(
            `${event.dataTransfer.getData("text/uri-list")}\n${event.dataTransfer.getData("text/plain")}`,
          );
          if (listed) {
            onPath(listed);
            return;
          }
          const file = event.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        {dropLabel}
      </div>
    </section>
  );
}
