import { useEffect, useState } from "react";
import { parseDeck } from "../model/parse";
import type { Deck } from "../model/schema";
import { SlideView } from "../slides/SlideView";

export function Audience({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [blank, setBlank] = useState<null | "black" | "white">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(`web-slider:${deckId}`);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        yaml?: unknown;
        slideIndex?: unknown;
        revealed?: unknown;
        blank?: unknown;
      };
      if (!data || data.type !== "web-slider:show" || typeof data.yaml !== "string") return;
      try {
        const parsed = parseDeck(data.yaml);
        setDeck(parsed);
        setSlideIndex(typeof data.slideIndex === "number" ? data.slideIndex : 0);
        setRevealed(typeof data.revealed === "number" ? data.revealed : 0);
        setBlank(data.blank === "black" || data.blank === "white" ? data.blank : null);
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
  }, [deckId]);

  if (error) return <p className="banner">{error}</p>;
  if (!deck) return <main className="start"><p>Waiting for the presenter window.</p></main>;
  const slide = deck.slides[slideIndex];
  if (!slide) return <p className="banner">The presenter is on a slide this window does not have.</p>;

  return (
    <div className="audience">
      <div className="stage">
        <SlideView deck={deck} slide={slide} revealed={revealed} />
      </div>
      {blank ? <div className="audience-blank" style={{ background: blank }} /> : null}
    </div>
  );
}
