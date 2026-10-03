import { useEffect, useRef, useState } from "react";
import { BrandLockup, resolveBrand, resolveChrome, withAssetUrls, type ChromeMode } from "../brand/kit";
import { bytesToBlob, downloadBlob, downloadText } from "../export/download";
import { deckToYaml } from "../export/yaml";
import type { Deck } from "../model/schema";
import { resolveTheme } from "../model/schema";
import { formatSessionBlock, type DeckSession, type WidgetAnswer } from "../model/session";
import { locateProbe, probeAt, slideIndexInProbe, type ProbePath } from "../model/probe";
import { jumpTo, jumpToVisibleNumber, moveBack, moveForward, revealThresholds, visibleIndexes, visibleNumber } from "../model/steps";
import { startCaptions } from "../present/captions";
import { SlideView } from "../slides/SlideView";
import { fontFaceRules } from "../theme/fonts";
import { BottomBar } from "./BottomBar";
import { Icon, IconButton } from "./IconButton";
import { Overview } from "./Overview";
import { SidePanel } from "./SidePanel";
import { Toc } from "./Toc";
import { YamlPane } from "./YamlPane";

export function Shell({
  deck,
  session,
  onSession,
  onOpenFile,
  requestOpen,
  persistError,
  assets,
  embed = false,
  manifestPath,
  exportDeck,
  packageFiles,
  sourceYaml = "",
  yamlError = null,
  onYaml,
  onEditTitle,
  onEditItem,
}: {
  deck: Deck;
  session: DeckSession;
  onSession: (recipe: (session: DeckSession) => DeckSession) => void;
  requestOpen: () => void;
  onOpenFile: (file: File) => void;
  persistError: string | null;
  assets?: Map<string, string>;
  embed?: boolean;
  manifestPath?: string;
  exportDeck?: Deck;
  packageFiles?: Map<string, Uint8Array>;
  sourceYaml?: string;
  yamlError?: string | null;
  onYaml?: (yaml: string) => void;
  onEditTitle?: (title: string) => void;
  onEditItem?: (blockIndex: number, itemIndex: number, text: string) => void;
}) {
  const portable = exportDeck ?? deck;
  const slide = deck.slides[session.slideIndex];
  const nextIndex = visibleIndexes(deck).find((index) => index > session.slideIndex);
  const nextSlide = nextIndex === undefined ? undefined : deck.slides[nextIndex];
  const theme = resolveTheme(deck.theme, slide.theme);
  const brand = withAssetUrls(resolveBrand(deck.brand), assets);
  const mode = session.ui.theme;
  const [overview, setOverview] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [blank, setBlank] = useState<null | "black" | "white">(null);
  const [laserOn, setLaserOn] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [laserPoint, setLaserPoint] = useState<{ x: number; y: number } | null>(null);
  const [caption, setCaption] = useState("");
  const [captionError, setCaptionError] = useState<string | null>(null);
  const laser = laserOn ? laserPoint : null;
  const laserRef = useRef(laser);
  const captionRef = useRef(caption);
  laserRef.current = laser;
  captionRef.current = caption;
  const digits = useRef("");
  const [yamlDraft, setYamlDraft] = useState(sourceYaml);
  const [probe, setProbe] = useState<ProbePath | null>(null);
  const [probeSelection, setProbeSelection] = useState<{ start: number; end: number; token: number } | null>(null);
  const [sessionLit, setSessionLit] = useState(false);
  const [sessionMark, setSessionMark] = useState(0);
  const probeToken = useRef(0);
  const sessionText = formatSessionBlock(slide.id, session.notes[slide.id] ?? "", session.answers[slide.id]);

  function selectProbe(path: ProbePath) {
    setSessionLit(false);
    setProbe(path);
    const range = locateProbe(yamlDraft, path);
    if (!range) return;
    probeToken.current += 1;
    setProbeSelection({ start: range.start, end: range.end, token: probeToken.current });
  }

  function showSession() {
    setProbe(null);
    setSessionLit(true);
    setSessionMark((mark) => mark + 1);
  }

  function caretProbe(offset: number, jump: boolean) {
    setSessionLit(false);
    const path = probeAt(yamlDraft, offset);
    setProbe(path);
    if (!jump) return;
    const index = slideIndexInProbe(path);
    if (index != null && index !== session.slideIndex && deck.slides[index]) {
      onSession((current) => ({ ...current, ...jumpTo(deck, index) }));
    }
  }
  useEffect(() => {
    setYamlDraft(sourceYaml);
  }, [sourceYaml]);
  const { elapsed, restart } = useElapsed();
  const clock = useClock();
  const palette = resolveChrome(deck.theme, mode, brand);

  useEffect(() => {
    if (!deck.fonts) return;
    const rules = fontFaceRules(deck.fonts, assets);
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
    if (embed || !sourceYaml) return;
    const channel = new BroadcastChannel(`web-slider:${deck.id}`);
    const send = () => {
      channel.postMessage({
        type: "web-slider:show",
        yaml: sourceYaml,
        slideIndex: session.slideIndex,
        revealed: session.revealed,
        blank,
        laser: laserRef.current,
        caption: captionRef.current,
      });
    };
    send();
    const onHello = (event: MessageEvent) => {
      const data = event.data as { type?: string };
      if (data?.type === "web-slider:hello") send();
    };
    channel.addEventListener("message", onHello);
    return () => {
      channel.removeEventListener("message", onHello);
      channel.close();
    };
  }, [blank, deck.id, embed, session.revealed, session.slideIndex, sourceYaml]);

  useEffect(() => {
    if (embed) return;
    const channel = new BroadcastChannel(`web-slider:${deck.id}`);
    channel.postMessage({ type: "web-slider:pointer", laser });
    channel.postMessage({ type: "web-slider:caption", caption });
    return () => channel.close();
  }, [caption, deck.id, embed, laser]);

  useEffect(() => {
    if (!captionsOn) return;
    return startCaptions(setCaption, (message) => {
      setCaptionsOn(false);
      setCaption("");
      setCaptionError(message);
    });
  }, [captionsOn]);

  useEffect(() => {
    if (!slide.autoAdvance || blank) return;
    const last = revealThresholds(slide).at(-1) ?? 0;
    if (session.revealed < last) return;
    const timer = window.setTimeout(() => {
      onSession((current) => ({ ...current, ...moveForward(deck, current.slideIndex, current.revealed) }));
    }, slide.autoAdvance * 1000);
    return () => window.clearTimeout(timer);
  }, [blank, deck, onSession, session.revealed, slide]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isTypingTarget(event.target)) return;
        if (overview) setOverview(false);
        else if (themeOpen) setThemeOpen(false);
        else if (exportOpen) setExportOpen(false);
        else if (session.ui.side && !session.ui.sidePinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, side: false } }));
        } else if (session.ui.yaml && !session.ui.yamlPinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, yaml: false } }));
        } else if (session.ui.toc && !session.ui.tocPinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, toc: false } }));
        } else {
          return;
        }
        event.preventDefault();
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (
        blank &&
        event.key !== "b" &&
        event.key !== "B" &&
        event.key !== "w" &&
        event.key !== "W" &&
        event.key !== "l" &&
        event.key !== "L" &&
        event.key !== "c" &&
        event.key !== "C"
      ) {
        setBlank(null);
        event.preventDefault();
        return;
      }
      if (event.key === "b" || event.key === "B") {
        setBlank("black");
        event.preventDefault();
        return;
      }
      if (event.key === "w" || event.key === "W") {
        setBlank("white");
        event.preventDefault();
        return;
      }
      if (!embed && (event.key === "l" || event.key === "L")) {
        setLaserOn((on) => !on);
        event.preventDefault();
        return;
      }
      if (!embed && (event.key === "c" || event.key === "C")) {
        setCaptionError(null);
        setCaptionsOn((on) => {
          if (on) setCaption("");
          return !on;
        });
        event.preventDefault();
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        digits.current = `${digits.current}${event.key}`.slice(-3);
        event.preventDefault();
        return;
      }
      if (event.key === "Enter" && digits.current) {
        const target = jumpToVisibleNumber(deck, Number(digits.current));
        digits.current = "";
        if (target) onSession((current) => ({ ...current, ...target }));
        event.preventDefault();
        return;
      }
      digits.current = "";
      if (event.key === " " && event.target instanceof HTMLElement && event.target.tagName === "BUTTON") return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault();
        onSession((current) => ({ ...current, ...moveForward(deck, current.slideIndex, current.revealed) }));
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        onSession((current) => ({ ...current, ...moveBack(deck, current.slideIndex, current.revealed) }));
      } else if (event.key === "Home") {
        event.preventDefault();
        const first = visibleIndexes(deck)[0] ?? 0;
        onSession((current) => ({ ...current, slideIndex: first, revealed: 0 }));
      } else if (event.key === "End") {
        event.preventDefault();
        const visible = visibleIndexes(deck);
        const last = visible[visible.length - 1] ?? deck.slides.length - 1;
        onSession((current) => ({ ...current, ...jumpTo(deck, last) }));
      } else if (event.key === "o" || event.key === "O") {
        setOverview((open) => !open);
      } else if (event.key === "f" || event.key === "F") {
        void toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blank, deck, embed, exportOpen, onSession, overview, session.ui.side, session.ui.sidePinned, session.ui.toc, session.ui.tocPinned, session.ui.yaml, session.ui.yamlPinned, themeOpen]);

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
      data-manifest={manifestPath}
      data-theme={mode}
      data-toc-pin={session.ui.toc && session.ui.tocPinned ? "open" : "closed"}
      data-side-pin={session.ui.side && session.ui.sidePinned ? "open" : "closed"}
      data-yaml-pin={session.ui.yaml && session.ui.yamlPinned ? "open" : "closed"}
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
            {visibleNumber(deck, session.slideIndex) ?? "—"} / {visibleIndexes(deck).length}
          </p>
          <IconButton
            label="Next"
            onClick={() => onSession((current) => ({ ...current, ...moveForward(deck, current.slideIndex, current.revealed) }))}
          >
            <Icon name="next" />
          </IconButton>
        </div>
        <div className="toolbar-actions" hidden={embed}>
          <p className="timer" aria-label="Clock" title="Clock">
            {clock}
          </p>
          <p className="timer" aria-label="Elapsed time" title="Elapsed time">
            {formatElapsed(elapsed)}
          </p>
          <IconButton label="Restart timer" onClick={restart}>
            <Icon name="restart" />
          </IconButton>
          {blank ? (
            <p className="timer" title="Audience screen">
              Audience is {blank}
            </p>
          ) : null}
          <IconButton label="Laser pointer" pressed={laserOn} onClick={() => setLaserOn((on) => !on)}>
            <Icon name="laser" />
          </IconButton>
          <IconButton
            label="Captions"
            pressed={captionsOn}
            onClick={() => {
              setCaptionError(null);
              setCaptionsOn((on) => {
                if (on) setCaption("");
                return !on;
              });
            }}
          >
            <Icon name="captions" />
          </IconButton>
          <IconButton
            label="Audience window"
            onClick={() => {
              window.open(
                `${window.location.pathname}?audience=1&id=${encodeURIComponent(deck.id)}`,
                "web-slider-audience",
                "width=1280,height=720",
              );
            }}
          >
            <Icon name="audience" />
          </IconButton>
          <IconButton label="Overview" pressed={overview} onClick={() => setOverview((open) => !open)}>
            <Icon name="overview" />
          </IconButton>
          <IconButton label={fullscreen ? "Exit" : "Full screen"} onClick={() => void toggleFullscreen()}>
            <Icon name={fullscreen ? "exit" : "fullscreen"} />
          </IconButton>
          <IconButton
            label="YAML"
            pressed={session.ui.yaml}
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, yaml: !current.ui.yaml } }))}
          >
            <Icon name="yaml" />
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
                        bytesToBlob(await buildPdf(deck, session, await loadFontFiles(deck.fonts, assets)), "application/pdf"),
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
                <IconButton
                  label="Handout"
                  disabled={exporting !== null}
                  onClick={() =>
                    void runExport("handout", async () => {
                      const { buildHandout } = await import("../export/docx");
                      downloadBlob(await buildHandout(deck, session), `${deck.id}-handout.docx`);
                    })
                  }
                >
                  <Icon name="notes" />
                </IconButton>
                <p className="font-limit">
                  PDF embeds the deck fonts. Word and PowerPoint name them and will substitute if they are not installed.
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${((visibleNumber(deck, session.slideIndex) ?? visibleIndexes(deck).length) / visibleIndexes(deck).length) * 100}%` }} />
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
        {!embed && session.ui.yaml && !session.ui.yamlPinned ? (
          <YamlPane
            className="pane floating right"
            value={yamlDraft}
            error={yamlError}
            pinned={false}
            selection={probeSelection}
            sessionText={sessionText}
            sessionLit={sessionLit}
            sessionMark={sessionMark}
            onCaret={caretProbe}
            onChange={(value) => {
              setYamlDraft(value);
              onYaml?.(value);
            }}
            onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, yamlPinned: true } }))}
            onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, yaml: false } }))}
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
        <SlideView
          deck={deck}
          slide={slide}
          revealed={session.revealed}
          onOpenSlide={(slideId) => {
            const index = deck.slides.findIndex((item) => item.id === slideId);
            if (index >= 0) jump(index);
          }}
          laser={laser}
          caption={caption}
          onLaserMove={laserOn ? setLaserPoint : undefined}
          onEditTitle={embed || yamlError ? undefined : onEditTitle}
          onEditItem={embed || yamlError ? undefined : onEditItem}
          slideIndex={session.slideIndex}
          probe={probe}
          onProbe={embed ? undefined : selectProbe}
          assets={assets}
        />
      </main>

      {!embed && session.ui.yaml && session.ui.yamlPinned ? (
        <YamlPane
          className="pane docked yaml-pane"
          value={yamlDraft}
          error={yamlError}
          pinned
          selection={probeSelection}
          sessionText={sessionText}
          sessionLit={sessionLit}
          sessionMark={sessionMark}
          onCaret={caretProbe}
          onChange={(value) => {
            setYamlDraft(value);
            onYaml?.(value);
          }}
          onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, yamlPinned: false } }))}
          onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, yaml: false } }))}
        />
      ) : null}

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
          slideIndex={session.slideIndex}
          probe={probe}
          onProbe={embed ? undefined : selectProbe}
          onNotesFocus={embed ? undefined : showSession}
          onNotes={(value) => {
            onSession((current) => ({
              ...current,
              notes: { ...current.notes, [slide.id]: value },
            }));
          }}
          onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottom: false } }))}
          nextPreview={
            embed ? undefined : nextSlide ? (
              <SlideView deck={deck} slide={nextSlide} revealed={0} assets={assets} />
            ) : (
              <p>End of deck</p>
            )
          }
        />
      ) : null}

      {overview ? <Overview slides={deck.slides} current={session.slideIndex} onJump={jump} onClose={() => setOverview(false)} /> : null}
      {persistError ? (
        <p className="banner" role="alert">
          {persistError}
        </p>
      ) : null}
      {captionError ? (
        <p className="banner" role="alert">
          {captionError}
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

function useElapsed(): { elapsed: number; restart: () => void } {
  const [start, setStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return { elapsed: Math.floor((now - start) / 1000), restart: () => setStart(Date.now()) };
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
