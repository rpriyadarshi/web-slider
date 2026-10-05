import { useEffect, useRef, useState } from "react";
import { BrandLockup, resolveBrand, resolveChrome, withAssetUrls, type ChromeMode } from "../brand/kit";
import { bytesToBlob } from "../export/blob";
import { shareCommandDisplay } from "../export/runnable";
import { ExportDownloaded, downloadExportFile, exportFile, hideScratchPath, saveExport, type ExportKind } from "../export/saveFile";
import { deckToYaml } from "../export/yaml";
import { shareBuild } from "../model/build";
import { editParsed, insertBlock, insertSlide, insertWidget, removeParsed } from "../model/insert";
import { caretSelection, locateProbe, removableNode, selectionTarget, slideIndexInProbe, type ProbePath } from "../model/probe";
import { resolveTheme, type Block, type Deck, type Widget } from "../model/schema";
import { clampPane, formatSessionBlock, type DeckSession, type PaneSize, type WidgetAnswer } from "../model/session";
import { jumpTo, jumpToVisibleNumber, moveBack, moveForward, revealThresholds, visibleIndexes, visibleNumber } from "../model/steps";
import { checkPackageFiles, writeDeckPackage } from "../package/deckPackage";
import { startCaptions } from "../present/captions";
import { SlideView } from "../slides/SlideView";
import { fontFaceRules } from "../theme/fonts";
import { BottomBar } from "./BottomBar";
import { Icon, IconButton } from "./IconButton";
import { Overview } from "./Overview";
import { SidePanel } from "./SidePanel";
import { Toc } from "./Toc";
import { Splitter } from "./Splitter";
import { YamlPane } from "./YamlPane";

function resizeUi(ui: DeckSession["ui"], key: PaneSize, delta: number): DeckSession["ui"] {
  return { ...ui, [key]: clampPane(key, ui[key] + delta) };
}

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
  onResetShipped,
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
  onResetShipped?: () => void;
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
  const [exportDownload, setExportDownload] = useState<{ blob: Blob; filename: string } | null>(null);
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
    const focused = selectionTarget(yamlDraft, path);
    setSessionLit(false);
    setProbe(focused);
    const range = locateProbe(yamlDraft, focused);
    if (!range) return;
    probeToken.current += 1;
    setProbeSelection({ start: range.start, end: range.end, token: probeToken.current });
  }

  function selectInserted(source: string, path: ProbePath) {
    const focused = selectionTarget(source, path);
    const range = locateProbe(source, focused);
    if (!range) throw new Error("The inserted node is not in the YAML.");
    setSessionLit(false);
    setProbe(focused);
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
    const selected = caretSelection(yamlDraft, offset);
    setProbe(selected?.path ?? null);
    if (!jump || !selected) return;
    const index = slideIndexInProbe(selected.path);
    if (index != null && index !== session.slideIndex && deck.slides[index]) {
      onSession((current) => ({ ...current, ...jumpTo(deck, index) }));
    }
  }

  function structureSlideIndex(): number {
    const fromCaret = slideIndexInProbe(probe);
    if (fromCaret != null && deck.slides[fromCaret]) return fromCaret;
    return session.slideIndex;
  }

  function applyInsert(change: (source: string) => { yaml: string; path: ProbePath }) {
    const result = editParsed(yamlDraft, yamlError !== null, change);
    if (!result) return;
    selectInserted(result.yaml, result.path);
    setYamlDraft(result.yaml);
    onYaml?.(result.yaml);
  }

  function applyRemoval(path: ProbePath) {
    const next = removeParsed(yamlDraft, yamlError !== null, path);
    if (next === null) return;
    setYamlDraft(next);
    onYaml?.(next);
    setProbe(null);
    setProbeSelection(null);
  }

  function insertSlideAfterCaret() {
    const after = structureSlideIndex();
    applyInsert((source) => insertSlide(source, after));
  }

  function insertBlockOnSlide(place: "blocks" | "side", type: Block["type"]) {
    const index = structureSlideIndex();
    applyInsert((source) => insertBlock(source, index, place, type));
  }

  function insertWidgetOnSlide(type: Widget["type"]) {
    const index = structureSlideIndex();
    applyInsert((source) => insertWidget(source, index, type));
  }

  function removeSelected() {
    const target = removableNode(probe);
    if (!target) return;
    applyRemoval(target);
  }

  function removeCurrentSlide() {
    if (yamlError || deck.slides.length <= 1) return;
    const index = structureSlideIndex();
    const next = removeParsed(yamlDraft, false, ["slides", index]);
    if (next === null) return;
    setYamlDraft(next);
    onYaml?.(next);
    setProbe(null);
    setProbeSelection(null);
    onSession((current) => {
      const viewed = current.slideIndex === index;
      const slideIndex =
        current.slideIndex > index ? current.slideIndex - 1 : viewed && index >= deck.slides.length - 1 ? index - 1 : current.slideIndex;
      return { ...current, slideIndex, revealed: viewed ? 0 : current.revealed };
    });
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
        }         else if (session.ui.toc && !session.ui.tocPinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, toc: false } }));
        } else if (session.ui.bottom && !session.ui.bottomPinned) {
          onSession((current) => ({ ...current, ui: { ...current.ui, bottom: false } }));
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
  }, [blank, deck, embed, exportOpen, onSession, overview, session.ui.bottom, session.ui.bottomPinned, session.ui.side, session.ui.sidePinned, session.ui.toc, session.ui.tocPinned, session.ui.yaml, session.ui.yamlPinned, themeOpen]);

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

  async function startExport(
    kind: ExportKind,
    deckId: string,
    build: () => Promise<Blob>,
    check?: () => void,
    commandOf?: () => string,
  ) {
    const file = exportFile(kind, deckId);
    setExporting(kind);
    setExportError(null);
    setExportDownload(null);
    try {
      await saveExport({ ...file, check, build });
      const command = commandOf?.() ?? "";
      setExportError(command ? shareCommandDisplay(command) : `Exported ${file.suggestedName}.`);
    } catch (error) {
      const message = hideScratchPath(error instanceof Error ? error.message : String(error));
      const command = commandOf?.() ?? "";
      setExportError(command ? `${shareCommandDisplay(command)}\n${message}` : message);
      if (error instanceof ExportDownloaded) setExportDownload({ blob: error.blob, filename: error.filename });
    } finally {
      setExporting(null);
    }
  }

  function dismissExportBanner() {
    setExportError(null);
    setExportDownload(null);
  }

  const menuOpen = themeOpen || exportOpen;
  const canRemove = !yamlError && removableNode(probe) !== null;
  const canRemoveSlide = !yamlError && deck.slides.length > 1;
  const presenter = (
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
      pinned={session.ui.bottomPinned}
      onPin={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottomPinned: !current.ui.bottomPinned } }))}
      onHide={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottom: false } }))}
      onDecisions={embed ? undefined : (delta) => onSession((current) => ({ ...current, ui: resizeUi(current.ui, "decisionsWidth", delta) }))}
      onNotesWidth={embed ? undefined : (delta) => onSession((current) => ({ ...current, ui: resizeUi(current.ui, "notesWidth", delta) }))}
      onHeight={embed ? undefined : (delta) => onSession((current) => ({ ...current, ui: resizeUi(current.ui, "bottomHeight", -delta) }))}
      nextPreview={
        embed ? undefined : nextSlide ? (
              <SlideView deck={deck} slide={nextSlide} revealed={0} assets={assets} />
        ) : (
          <p>End of deck</p>
        )
      }
    />
  );

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
        ["--toc-col" as string]: session.ui.toc && session.ui.tocPinned ? `${session.ui.tocWidth}px` : "0px",
        ["--yaml-col" as string]: session.ui.yaml && session.ui.yamlPinned ? `${session.ui.yamlWidth}px` : "0px",
        ["--side-col" as string]: session.ui.side && session.ui.sidePinned ? `${session.ui.sideWidth}px` : "0px",
        ["--bottom-row" as string]: embed || (session.ui.bottom && session.ui.bottomPinned) ? `${session.ui.bottomHeight}px` : "0px",
        ["--bottom-size" as string]: `${session.ui.bottomHeight}px`,
        ["--decisions-col" as string]: `${session.ui.decisionsWidth}px`,
        ["--notes-col" as string]: `${session.ui.notesWidth}px`,
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
            label="Outline"
            pressed={session.ui.toc}
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, toc: !current.ui.toc } }))}
          >
            <Icon name="outline" />
          </IconButton>
          <IconButton
            label="Examples"
            pressed={session.ui.side}
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, side: !current.ui.side } }))}
          >
            <Icon name="examples" />
          </IconButton>
          <IconButton
            label="YAML"
            pressed={session.ui.yaml}
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, yaml: !current.ui.yaml } }))}
          >
            <Icon name="yaml" />
          </IconButton>
          <IconButton
            label="Presenter"
            pressed={session.ui.bottom}
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottom: !current.ui.bottom } }))}
          >
            <Icon name="notes" />
          </IconButton>
          <IconButton label="Open" onClick={requestOpen}>
            <Icon name="open" />
          </IconButton>
          {onResetShipped ? (
            <IconButton
              label="Reset to shipped"
              onClick={() => {
                if (window.confirm("Replace the current slides and session notes with the shipped talk?")) onResetShipped();
              }}
            >
              <Icon name="shipped" />
            </IconButton>
          ) : null}
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
                  onClick={() => {
                    void startExport("yaml", portable.id, async () => new Blob([deckToYaml(portable, session)], { type: "application/yaml" }));
                  }}
                >
                  <Icon name="yaml" />
                </IconButton>
                <IconButton
                  label="PDF"
                  disabled={exporting !== null}
                  onClick={() => {
                    void startExport("pdf", deck.id, async () => {
                      const [{ buildPdf }, { loadFontFiles }] = await Promise.all([
                        import("../export/pdf"),
                        import("../theme/fonts"),
                      ]);
                      return bytesToBlob(await buildPdf(deck, session, await loadFontFiles(deck.fonts, assets)), "application/pdf");
                    });
                  }}
                >
                  <Icon name="pdf" />
                </IconButton>
                <IconButton
                  label="Word"
                  disabled={exporting !== null}
                  onClick={() => {
                    void startExport("docx", deck.id, async () => {
                      const { buildDocx } = await import("../export/docx");
                      return buildDocx(deck, session);
                    });
                  }}
                >
                  <Icon name="word" />
                </IconButton>
                <IconButton
                  label="PowerPoint"
                  disabled={exporting !== null}
                  onClick={() => {
                    void startExport("pptx", deck.id, async () => {
                      const { buildPptx } = await import("../export/pptx");
                      return buildPptx(deck, session);
                    });
                  }}
                >
                  <Icon name="powerpoint" />
                </IconButton>
                <IconButton
                  label="Package"
                  disabled={exporting !== null}
                  onClick={() => {
                    void startExport(
                      "package",
                      portable.id,
                      () => writeDeckPackage(deckToYaml(portable, session), packageFiles ?? new Map()),
                      () => checkPackageFiles(portable, packageFiles ?? new Map()),
                    );
                  }}
                >
                  <Icon name="package" />
                </IconButton>
                {shareBuild ? null : (
                  <IconButton
                    label="Runnable package"
                    disabled={exporting !== null}
                    onClick={() => {
                    const command = { text: "" };
                    void startExport(
                      "runnable",
                      portable.id,
                      async () => {
                        const { RunnableExportError, requestRunnablePackage } = await import("../export/runnable");
                        const talk = await writeDeckPackage(sourceYaml, packageFiles ?? new Map());
                        const fetchImpl: typeof fetch = (input, init) => window.fetch(input, init);
                        try {
                          const packed = await requestRunnablePackage(fetchImpl, window.location.origin, talk, portable.id);
                          command.text = packed.command;
                          return packed.blob;
                        } catch (error) {
                          if (error instanceof RunnableExportError) command.text = error.command;
                          throw error;
                        }
                      },
                      () => {
                        if (!sourceYaml) throw new Error("No talk is open to package.");
                        checkPackageFiles(portable, packageFiles ?? new Map());
                      },
                      () => command.text,
                    );
                    }}
                  >
                    <Icon name="runnable" />
                  </IconButton>
                )}
                <IconButton
                  label="Handout"
                  disabled={exporting !== null}
                  onClick={() => {
                    void startExport("handout", deck.id, async () => {
                      const { buildHandout } = await import("../export/docx");
                      return buildHandout(deck, session);
                    });
                  }}
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

      {!embed && session.ui.toc && session.ui.tocPinned ? (
        <Splitter className="shell-toc" axis="x" label="Resize outline" onDelta={(delta) => onSession((current) => ({ ...current, ui: resizeUi(current.ui, "tocWidth", delta) }))} />
      ) : null}
      {!embed && session.ui.yaml && session.ui.yamlPinned ? (
        <Splitter className="shell-yaml" axis="x" label="Resize YAML" onDelta={(delta) => onSession((current) => ({ ...current, ui: resizeUi(current.ui, "yamlWidth", -delta) }))} />
      ) : null}
      {!embed && session.ui.side && session.ui.sidePinned ? (
        <Splitter className="shell-side" axis="x" label="Resize examples" onDelta={(delta) => onSession((current) => ({ ...current, ui: resizeUi(current.ui, "sideWidth", -delta) }))} />
      ) : null}

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
          <IconButton
            className="reopen right"
            label="Examples"
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, side: true } }))}
          >
            <Icon name="examples" />
          </IconButton>
        ) : null}
        {!embed && !session.ui.yaml ? (
          <IconButton
            className="reopen yaml"
            label="YAML"
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, yaml: true } }))}
          >
            <Icon name="yaml" />
          </IconButton>
        ) : null}
        {!embed && !session.ui.bottom ? (
          <IconButton
            className="reopen presenter"
            label="Presenter"
            onClick={() => onSession((current) => ({ ...current, ui: { ...current.ui, bottom: true } }))}
          >
            <Icon name="notes" />
          </IconButton>
        ) : null}
        {!embed && session.ui.bottom && !session.ui.bottomPinned ? presenter : null}
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
            onInsertSlide={insertSlideAfterCaret}
            onInsertBlock={insertBlockOnSlide}
            onInsertWidget={insertWidgetOnSlide}
            onRemove={removeSelected}
            canRemove={canRemove}
            onRemoveSlide={removeCurrentSlide}
            canRemoveSlide={canRemoveSlide}
          />
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
          onInsertSlide={insertSlideAfterCaret}
          onInsertBlock={insertBlockOnSlide}
          onInsertWidget={insertWidgetOnSlide}
          onRemove={removeSelected}
          canRemove={canRemove}
          onRemoveSlide={removeCurrentSlide}
          canRemoveSlide={canRemoveSlide}
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

      {embed || (session.ui.bottom && session.ui.bottomPinned) ? presenter : null}

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
        <div className="banner export-banner" role="alert">
          <span className="export-banner-text">{exportError}</span>
          <span className="export-banner-actions">
            {exportDownload ? (
              <button
                type="button"
                onClick={() => downloadExportFile(exportDownload.blob, exportDownload.filename)}
              >
                Save {exportDownload.filename} again
              </button>
            ) : null}
            <IconButton label="Hide" onClick={dismissExportBanner}>
              <Icon name="hide" />
            </IconButton>
          </span>
        </div>
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
