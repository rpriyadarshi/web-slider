import { useEffect, useLayoutEffect, useRef, useState } from "react";

const TIP_ID = "presenter-tip";
const HOVER_MS = 400;

type Tip = {
  title: string;
  body: string;
  keys: string[];
  rect: DOMRect;
  owner: HTMLElement;
};

export function Keys({ caps }: { caps: readonly string[] }) {
  return (
    <span className="keys">
      {caps.map((cap) => (
        <kbd key={cap}>{cap}</kbd>
      ))}
    </span>
  );
}

function tipTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const found = target.closest("[data-tip-title]");
  return found instanceof HTMLElement ? found : null;
}

function readTip(owner: HTMLElement): Tip {
  return {
    title: owner.dataset.tipTitle ?? "",
    body: owner.dataset.tip ?? "",
    keys: (owner.dataset.tipKeys ?? "").split("|").filter((key) => key.length > 0),
    rect: owner.getBoundingClientRect(),
    owner,
  };
}

export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const node = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = node.current;
    if (!tip || !el) return;
    const box = el.getBoundingClientRect();
    const margin = 8;
    let left = tip.rect.left;
    if (left + box.width > window.innerWidth - margin) left = window.innerWidth - margin - box.width;
    if (left < margin) left = margin;
    let top = tip.rect.bottom + margin;
    if (top + box.height > window.innerHeight - margin) top = Math.max(margin, tip.rect.top - margin - box.height);
    setPos({ top, left });
  }, [tip]);

  useEffect(() => {
    if (!tip) return;
    tip.owner.setAttribute("aria-describedby", TIP_ID);
    return () => tip.owner.removeAttribute("aria-describedby");
  }, [tip]);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let warm = false;
    let timer = 0;

    function hide() {
      window.clearTimeout(timer);
      current = null;
      setTip(null);
      setPos(null);
    }

    function show(owner: HTMLElement) {
      setPos(null);
      setTip(readTip(owner));
    }

    function schedule(owner: HTMLElement) {
      window.clearTimeout(timer);
      current = owner;
      timer = window.setTimeout(() => {
        warm = true;
        show(owner);
      }, warm ? 0 : HOVER_MS);
    }

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const owner = tipTarget(event.target);
      if (!owner || owner === current) return;
      schedule(owner);
    };
    const onOut = (event: PointerEvent) => {
      const owner = tipTarget(event.target);
      const next = event.relatedTarget instanceof Element ? tipTarget(event.relatedTarget) : null;
      if (!owner || owner !== current || next) return;
      warm = false;
      hide();
    };
    const onFocus = (event: FocusEvent) => {
      const owner = tipTarget(event.target);
      if (!owner || !owner.matches(":focus-visible")) return;
      window.clearTimeout(timer);
      warm = true;
      current = owner;
      show(owner);
    };
    const onBlur = (event: FocusEvent) => {
      const owner = tipTarget(event.target);
      if (owner && owner === current) hide();
    };
    const onDown = () => {
      warm = false;
      hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!tip) return null;
  return (
    <div
      ref={node}
      id={TIP_ID}
      role="tooltip"
      className="tip"
      style={{ top: pos?.top ?? 0, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
    >
      <strong>
        {tip.title}
        {tip.keys.length > 0 ? <Keys caps={tip.keys} /> : null}
      </strong>
      {tip.body ? <p>{tip.body}</p> : null}
    </div>
  );
}
