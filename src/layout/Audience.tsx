import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { presentTalk, type Install } from "../model/install";
import { parseDeck } from "../model/parse";
import type { Deck } from "../model/schema";
import { deckWithAssetUrls } from "../package/deckPackage";
import { fitScale, slideReference, viewScale } from "../present/stageZoom";
import { SlideView } from "../slides/SlideView";

export function Audience({ deckId, install }: { deckId: string; install: Install }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [blank, setBlank] = useState<null | "black" | "white">(null);
  const [laser, setLaser] = useState<{ x: number; y: number } | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stageFrameRef = useRef<HTMLDivElement>(null);
  const [pageFit, setPageFit] = useState(1);

  useEffect(() => {
    const channel = new BroadcastChannel(`web-slider:${deckId}`);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        yaml?: unknown;
        slideIndex?: unknown;
        revealed?: unknown;
        blank?: unknown;
        laser?: unknown;
        caption?: unknown;
      };
      if (data?.type === "web-slider:pointer") {
        setLaser(readPoint(data.laser));
        return;
      }
      if (data?.type === "web-slider:caption") {
        setCaption(typeof data.caption === "string" ? data.caption : "");
        return;
      }
      if (!data || data.type !== "web-slider:show" || typeof data.yaml !== "string") return;
      try {
        const parsed = parseDeck(data.yaml);
        setDeck(deckWithAssetUrls(presentTalk(parsed, install.manifest), install.assetUrls));
        setSlideIndex(typeof data.slideIndex === "number" ? data.slideIndex : 0);
        setRevealed(typeof data.revealed === "number" ? data.revealed : 0);
        setBlank(data.blank === "black" || data.blank === "white" ? data.blank : null);
        setLaser(readPoint(data.laser));
        setCaption(typeof data.caption === "string" ? data.caption : "");
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The audience window could not read the deck.");
      }
    };
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "web-slider:hello" });
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [deckId, install]);

  const aspect = deck?.aspect === "4:3" ? "4:3" : "16:9";
  const pageRef = slideReference(aspect);

  useLayoutEffect(() => {
    const frame = stageFrameRef.current;
    if (!frame || !deck) return;

    const measure = () => {
      const next = fitScale(frame.clientWidth, frame.clientHeight, pageRef.width, pageRef.height);
      setPageFit((prev) => (Math.abs(prev - next) < 0.0001 ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [deck, pageRef.height, pageRef.width]);

  if (error) return <p className="banner">{error}</p>;
  if (!deck) return <main className="start"><p>Waiting for the presenter window.</p></main>;
  const slide = deck.slides[slideIndex];
  if (!slide) return <p className="banner">The presenter is on a slide this window does not have.</p>;

  return (
    <div className="audience">
      <div
        ref={stageFrameRef}
        className="stage stage-frame"
        data-aspect={aspect}
        style={
          {
            "--page-w": `${pageRef.width}px`,
            "--page-h": `${pageRef.height}px`,
            "--view-scale": String(viewScale(pageFit, 1)),
          } as CSSProperties
        }
      >
        <div className="stage-zoom-space">
          <div className="stage-page-slot">
            <div className="stage-page">
              <SlideView deck={deck} slide={slide} revealed={revealed} laser={laser} assets={install.assetUrls} />
            </div>
          </div>
        </div>
      </div>
      {blank ? <div className="audience-blank" style={{ background: blank }} /> : null}
      {caption ? <p className="captions audience-captions">{caption}</p> : null}
    </div>
  );
}

function readPoint(value: unknown): { x: number; y: number } | null {
  if (!value || typeof value !== "object") return null;
  const point = value as { x?: unknown; y?: unknown };
  if (typeof point.x !== "number" || typeof point.y !== "number") return null;
  if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  return { x: point.x, y: point.y };
}
