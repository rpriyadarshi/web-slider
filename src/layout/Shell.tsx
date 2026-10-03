import { useEffect, useState } from "react";
import { BrandLockup, EMPORION_FAVICON, resolveBrand, resolveChrome, type ChromeMode } from "../brand/kit";
import { bytesToBlob, downloadBlob, downloadText } from "../export/download";
import { deckToYaml } from "../export/yaml";
import type { Deck } from "../model/schema";
import { resolveTheme } from "../model/schema";
import type { DeckSession, WidgetAnswer } from "../model/session";
import { jumpTo, moveBack, moveForward } from "../model/steps";
import { SlideView } from "../slides/SlideView";
import { BottomBar } from "./BottomBar";
import { Icon, IconButton } from "./IconButton";
import { Overview } from "./Overview";
import { SidePanel } from "./SidePanel";
import { Toc } from "./Toc";

export function Shell({
  deck,
  session,
  onSession,
  onOpenFile,
  requestOpen,
  persistError,
  assets,
  embed = false,
  exportDeck,
  packageFiles,
}: {
  deck: Deck;
  session: DeckSession;
  onSession: (recipe: (session: DeckSession) => DeckSession) => void;
  requestOpen: () => void;
  onOpenFile: (file: File) => void;
  persistError: string | null;
  assets?: Map<string, string>;
  embed?: boolean;
  exportDeck?: Deck;
  packageFiles?: Map<string, Uint8Array>;
}) {
  const portable = exportDeck ?? deck;
  const slide = deck.slides[session.slideIndex];
  const theme = resolveTheme(deck.theme, slide.theme);
  const rawBrand = resolveBrand(deck.brand);
  const brand = rawBrand && {
    ...rawBrand,
    markLight: assets?.get(rawBrand.markLight) ?? rawBrand.markLight,
    markDark: assets?.get(rawBrand.markDark) ?? rawBrand.markDark,
  };
  const mode = session.ui.theme;
  const [overview, setOverview] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const elapsed = useElapsed();
  const palette = resolveChrome(deck.theme, mode, brand);

  useEffect(() => {
    if (!deck.fonts) return;
    const rules = Object.entries(deck.fonts)
      .map(([name, face]) => {
        const regular = assets?.get(face.regular) ?? (face.regular.startsWith("data:") || face.regular.startsWith("https://") ? face.regular : "");
        if (!regular) return "";
        const semiRef = face.semibold;
        const semibold = semiRef
          ? (assets?.get(semiRef) ?? (semiRef.startsWith("data:") || semiRef.startsWith("https://") ? semiRef : regular))
          : regular;
        return `@font-face{font-family:"${name}";src:url("${regular}") format("truetype");font-weight:400;font-display:swap;}@font-face{font-family:"${name}";src:url("${semibold}") format("truetype");font-weight:600;font-display:swap;}`;
      })
      .join("");
    if (!rules) return;
    const style = document.createElement("style");
    style.dataset.deckFonts = deck.id;
    style.textContent = rules;
    document.head.appendChild(style);
    return () => style.remove();
  }, [assets, deck.fonts, deck.id]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (brand?.id !== "emporion") return;
    let link = document.querySelector<HTMLLinkElement>("link[data-brand-icon='true']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.setAttribute("data-brand-icon", "true");
      document.head.appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = EMPORION_FAVICON;
  }, [brand]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (overview) setOverview(false);
        else if (themeOpen) setThemeOpen(false);
        else if (exportOpen) setExportOpen(false);
        else if (session.ui.side && !session.ui.sidePinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, side: false } }));
        } else if (session.ui.toc && !session.ui.tocPinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, toc: false } }));
        } else {
          return;
        }
        event.preventDefault();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === " " && event.target instanceof HTMLElement && event.target.tagName === "BUTTON") return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        onSession((current) => ({ ...current, ...moveForward(deck, current.slideIndex, current.revealed) }));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        onSession((current) => ({ ...current, ...moveBack(deck, current.slideIndex, current.revealed) }));
      } else if (event.key === "Home") {
        event.preventDefault();
        onSession((current) => ({ ...current, slideIndex: 0, revealed: 0 }));
      } else if (event.key === "End") {
        event.preventDefault();
        onSession((current) => ({ ...current, ...jumpTo(deck, deck.slides.length - 1) }));
      } else if (event.key === "o" || event.key === "O") {
        setOverview((open) => !open);
      } else if (event.key === "f" || event.key === "F") {
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, exportOpen, onSession, overview, session.ui.side, session.ui.sidePinned, session.ui.toc, session.ui.tocPinned, themeOpen]);

  function jump(index: number) {
    onSession((current) => ({ ...current, ...jumpTo(deck, index) }));
    setOverview(false);
  }

  function setAnswer(widgetId: string, answer: WidgetAnswer | undefined) {
    onSession((current) => {
      const existing = { ...(current.answers[slide.id] ?? {}) };
      if (answer === undefined || (Array.isArray(answer) && answer.length === 0)) delete existing[widgetId];
      else existing[widgetId] = answer;
      return { ...current, answers: { ...current.answers, [slide.id]: existing } };
    });
  }

  function setMode(next: ChromeMode) {
    onSession((current) => ({ ...current, ui: { ...current.ui, theme: next } }));
    setThemeOpen(false);
  }

  async function runExport(kind: string, work: () => Promise<void>) {
    setExporting(kind);
    setExportError(null);
    try {
      await work();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(null);
    }
  }

  const menuOpen = themeOpen || exportOpen;

  return (
    <div
      className={embed ? "shell embed" : "shell"}
      data-theme={mode}
      data-toc-pin={session.ui.toc && session.ui.tocPinned ? "open" : "closed"}
      data-side-pin={session.ui.side && session.ui.sidePinned ? "open" : "closed"}
      data-bottom={session.ui.bottom ? "open" : "closed"}
      style={{
        ["--ground" as string]: palette.ground,
        ["--paper" as string]: palette.paper,
        ["--text" as string]: palette.text,
        ["--muted" as string]: palette.muted,
        ["--line" as string]: palette.line,
        ["--accent" as string]: palette.accent,
        ["--highlight" as string]: palette.highlight,
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) onOpenFile(file);
      }}
    >
      <header className="toolbar">
        <div className="brand">
          {brand ? <BrandLockup brand={brand} mode={mode} /> : null}
          <h1>{deck.title}</h1>
        </div>
        <div className="transport">
          <IconButton
            label="Previous"
            onClick={() => onSession((current) => ({ ...current, ...moveBack(deck, current.slideIndex, current.revealed) }))}
          >
            <Icon name="previous" />
          </IconButton>
          <p className="slide-count">
            {session.slideIndex + 1} / {deck.slides.length}
          </p>
          <IconButton
            label="Next"
            onClick={() => onSession((current) => ({ ...current, ...moveForward(deck, current.slideIndex, current.revealed) }))}
          >
            <Icon name="next" />
          </IconButton>
        </div>
        <div className="toolbar-actions" hidden={embed}>
          <p className="timer" aria-label="Elapsed time" title="Elapsed time">
            {formatElapsed(elapsed)}
          </p>
          <IconButton label="Overview" pressed={overview} onClick={() => setOverview((open) => !open)}>
            <Icon name="overview" />
          </IconButton>
          <IconButton label={fullscreen ? "Exit" : "Full screen"} onClick={() => void toggleFullscreen()}>
            <Icon name={fullscreen ? "exit" : "fullscreen"} />
          </IconButton>
          <IconButton label="Open" onClick={requestOpen}>
            <Icon name="open" />
          </IconButton>
          <div className="menu-anchor">
            <IconButton
              label="Theme"
              pressed={themeOpen}
              onClick={() => {
                setThemeOpen((open) => !open);
                setExportOpen(false);
              }}
            >
              <Icon name="theme" />
            </IconButton>
            {themeOpen ? (
              <div className="popup" role="menu" aria-label="Theme">
                <IconButton label="Light" pressed={mode === "light"} onClick={() => setMode("light")}>
                  <Icon name="light" />
                </IconButton>
                <IconButton label="Dark" pressed={mode === "dark"} onClick={() => setMode("dark")}>
                  <Icon name="dark" />
                </IconButton>
              </div>
            ) : null}
          </div>
          <div className="menu-anchor">
            <IconButton
              label="Export"
              pressed={exportOpen}
              disabled={exporting !== null}
              onClick={() => {
                setExportOpen((open) => !open);
                setThemeOpen(false);
              }}
            >
              <Icon name="export" />
            </IconButton>
            {exportOpen ? (
              <div className="popup export-popup" role="menu" aria-label="Export">
                <IconButton
                  label="YAML"
                  disabled={exporting !== null}
                  onClick={() =>
                    void runExport("yaml", async () =>
                      downloadText(deckToYaml(portable, session), `${portable.id}.yaml`, "application/yaml"),
                    )
                  }
                >
                  <Icon name="yaml" />
                </IconButton>
                <IconButton
                  label="PDF"
                  disabled={exporting !== null}
                  onClick={() =>
                    void runExport("pdf", async () => {
                      const [{ buildPdf }, { loadFontFiles }] = await Promise.all([
                        import("../export/pdf"),
                        import("../theme/fonts"),
                      ]);
                      downloadBlob(
                        bytesToBlob(await buildPdf(deck, session, await loadFontFiles()), "application/pdf"),
                        `${deck.id}.pdf`,
                      );
                    })
                  }
                >
                  <Icon name="pdf" />
                </IconButton>
                <IconButton
                  label="Word"
                  disabled={exporting !== null}
                  onClick={() =>
                    void runExport("docx", async () => {
                      const { buildDocx } = await import("../export/docx");
                      downloadBlob(await buildDocx(deck, session), `${deck.id}.docx`);
                    })
                  }
                >
                  <Icon name="word" />
                </IconButton>
                <IconButton
                  label="PowerPoint"
                  disabled={exporting !== null}
                  onClick={() =>
                    void runExport("pptx", async () => {
                      const { buildPptx } = await import("../export/pptx");
                      downloadBlob(await buildPptx(deck, session), `${deck.id}.pptx`);
                    })
                  }
                >
                  <Icon name="powerpoint" />
                </IconButton>
                <IconButton
                  label="Package"
                  disabled={exporting !== null}
                  onClick={() =>
                    void runExport("package", async () => {
                      const { writeDeckPackage } = await import("../package/deckPackage");
                      const blob = await writeDeckPackage(deckToYaml(portable, session), packageFiles ?? new Map());
                      downloadBlob(blob, `${portable.id}.zip`);
                    })
                  }
                >
                  <Icon name="package" />
                </IconButton>
                <p className="font-limit">
                  PDF embeds the deck fonts. Word and PowerPoint name them and will substitute if they are not installed.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${((session.slideIndex + 1) / deck.slides.length) * 100}%` }} />
        </div>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="scrim"
          aria-label="Hide"
          onClick={() => {
            setThemeOpen(false);
            setExportOpen(false);
          }}
        />
      ) : null}

      {!embed && session.ui.toc && session.ui.tocPinned ? (
        <Toc
          className="pane docked"
          slides={deck.slides}
          current={session.slideIndex}
          pinned
          onJump={jump}
          onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, tocPinned: false } }))}
          onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, toc: false } }))}
        />
      ) : null}

      <main className="stage">
        {!embed && !session.ui.toc ? (
          <IconButton
            className="reopen left"
            label="Outline"
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, toc: true } }))}
          >
            <Icon name="outline" />
          </IconButton>
        ) : null}
        {!embed && session.ui.toc && !session.ui.tocPinned ? (
          <Toc
            className="pane floating left"
            slides={deck.slides}
            current={session.slideIndex}
            pinned={false}
            onJump={jump}
            onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, tocPinned: true } }))}
            onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, toc: false } }))}
          />
        ) : null}
        {!embed && !session.ui.side ? (
          <button
            type="button"
            className="reopen right icon-button"
            aria-label="Examples"
            title="Examples"
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, side: true } }))}
          >
            <Icon name="examples" />
          </button>
        ) : null}
        {!embed && session.ui.side && !session.ui.sidePinned ? (
          <SidePanel
            className="pane floating right"
            blocks={slide.side}
            theme={theme}
            pinned={false}
            onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, sidePinned: true } }))}
            onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, side: false } }))}
          />
        ) : null}
        {!embed && ((session.ui.toc && !session.ui.tocPinned) || (session.ui.side && !session.ui.sidePinned)) ? (
          <button
            type="button"
            className="stage-scrim"
            aria-label="Hide"
            onClick={() =>
              onSession((current) => ({
                ...current,
                ui: {
                  ...current.ui,
                  toc: current.ui.tocPinned ? current.ui.toc : false,
                  side: current.ui.sidePinned ? current.ui.side : false,
                },
              }))
            }
          />
        ) : null}
        {!embed && !session.ui.bottom ? (
          <button
            type="button"
            className="reopen bottom icon-button"
            aria-label="Notes"
            title="Notes"
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottom: true } }))}
          >
            <Icon name="notes" />
          </button>
        ) : null}
        <SlideView deck={deck} slide={slide} revealed={session.revealed} />
      </main>

      {!embed && session.ui.side && session.ui.sidePinned ? (
        <SidePanel
          className="pane docked"
          blocks={slide.side}
          theme={theme}
          pinned
          onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, sidePinned: false } }))}
          onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, side: false } }))}
        />
      ) : null}

      {embed || session.ui.bottom ? (
        <BottomBar
          feedback={embed}
          slideId={slide.id}
          widgets={slide.widgets ?? []}
          answers={session.answers[slide.id]}
          script={slide.notes}
          notes={session.notes[slide.id] ?? ""}
          onAnswer={setAnswer}
          onNotes={(value) =>
            onSession((current) => ({
              ...current,
              notes: { ...current.notes, [slide.id]: value },
            }))
          }
          onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottom: false } }))}
        />
      ) : null}

      {overview ? <Overview slides={deck.slides} current={session.slideIndex} onJump={jump} onClose={() => setOverview(false)} /> : null}
      {persistError ? (
        <p className="banner" role="alert">
          {persistError}
        </p>
      ) : null}
      {exportError ? (
        <p className="banner" role="alert">
          {exportError}
        </p>
      ) : null}
      {exporting ? <p className="banner">Exporting {exporting}…</p> : null}
    </div>
  );
}

function useElapsed(): number {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return Math.floor((now - start) / 1000);
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await document.documentElement.requestFullscreen();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
