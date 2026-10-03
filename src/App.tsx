import { useEffect, useRef, useState } from "react";
import sampleDeck from "./sample/deck.yaml?raw";
import { Audience } from "./layout/Audience";
import { ErrorScreen } from "./layout/ErrorScreen";
import { Shell } from "./layout/Shell";
import { StartScreen } from "./layout/StartScreen";
import { parseDeck } from "./model/parse";
import type { Deck } from "./model/schema";
import { serializeDeck } from "./model/serialize";
import { normalizeSession, sessionFromDeck, type DeckSession } from "./model/session";
import { bindPackageAssets, deckWithAssetUrls, packageAssetRefs, readDeckPackage } from "./package/deckPackage";
import { clearPersisted, loadPersisted, savePersisted } from "./session/store";

const search = new URLSearchParams(window.location.search);
const embed = search.get("embed") === "1";
const audienceId = search.get("audience") === "1" ? search.get("id") : null;
const deckParam = search.get("deck");

export function App() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [sourceDeck, setSourceDeck] = useState<Deck | null>(null);
  const [deckYaml, setDeckYaml] = useState("");
  const [session, setSession] = useState<DeckSession | null>(null);
  const [packageFiles, setPackageFiles] = useState<Map<string, Uint8Array>>(new Map());
  const [assetUrls, setAssetUrls] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [canReturn, setCanReturn] = useState(false);
  const [storageBroken, setStorageBroken] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);
  const openRef = useRef<(source: string, files: Map<string, Uint8Array>, baseUrl?: string) => Promise<void>>(
    async () => undefined,
  );
  deckRef.current = deck;

  async function openPrepared(source: string, files: Map<string, Uint8Array>, baseUrl?: string) {
    try {
      const parsed = parseDeck(source);
      const next = sessionFromDeck(parsed);
      parseDeck(serializeDeck(parsed, next));
      const urls = await bindPackageAssets(packageAssetRefs(parsed), files, baseUrl);
      setSourceDeck(parsed);
      setDeck(deckWithAssetUrls(parsed, urls));
      setDeckYaml(source);
      setPackageFiles(files);
      setAssetUrls(urls);
      setSession(next);
      setError(null);
      setCanReturn(false);
      setStorageBroken(false);
      setPersistError(null);
    } catch (caught) {
      setError(messageOf(caught));
      setCanReturn(deckRef.current !== null);
    }
  }
  openRef.current = openPrepared;

  useEffect(() => {
    if (embed) {
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; yaml?: unknown; zip?: unknown };
        if (!data || data.type !== "web-slider:load") return;
        if (data.zip instanceof ArrayBuffer) {
          void readDeckPackage(data.zip)
            .then((pack) => openRef.current(pack.yaml, pack.files))
            .catch((caught: unknown) => {
              setError(messageOf(caught));
              setCanReturn(false);
            });
          return;
        }
        if (typeof data.yaml === "string") {
          void openRef.current(data.yaml, new Map());
        }
      };
      window.addEventListener("message", onMessage);
      if (!deckParam) {
        setHydrated(true);
        return () => window.removeEventListener("message", onMessage);
      }
      void fetch(deckParam)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Deck failed to load (${response.status}).`);
          if (deckParam.endsWith(".zip")) {
            const pack = await readDeckPackage(await response.arrayBuffer());
            await openRef.current(pack.yaml, pack.files, new URL("./", deckParam).href);
          } else {
            await openRef.current(await response.text(), new Map(), new URL("./", deckParam).href);
          }
        })
        .catch((caught: unknown) => {
          setError(messageOf(caught));
          setCanReturn(false);
        })
        .finally(() => setHydrated(true));
      return () => window.removeEventListener("message", onMessage);
    }

    try {
      const saved = loadPersisted();
      if (saved) {
        const parsed = parseDeck(saved.deckYaml);
        const next = normalizeSession(parsed, saved.session);
        parseDeck(serializeDeck(parsed, next));
        setSourceDeck(parsed);
        setDeck(parsed);
        setDeckYaml(saved.deckYaml);
        setSession(next);
      }
    } catch (caught) {
      setError(messageOf(caught));
      setStorageBroken(true);
      setCanReturn(false);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !deck || !session || embed) return;
    try {
      savePersisted({ deckYaml, session });
      setPersistError(null);
    } catch (caught) {
      setPersistError(`Notes could not be stored in this browser. Download the YAML before you leave. ${messageOf(caught)}`);
    }
  }, [hydrated, deck, deckYaml, session]);

  useEffect(() => {
    if (!embed || !sourceDeck || !session) return;
    const slide = sourceDeck.slides[session.slideIndex];
    window.parent.postMessage(
      {
        type: "web-slider:feedback",
        deckId: sourceDeck.id,
        slideId: slide?.id,
        answers: session.answers,
        notes: session.notes,
      },
      "*",
    );
  }, [sourceDeck, session]);

  useEffect(() => {
    if (!persistError || embed) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [persistError]);

  function openFile(file: File) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      void file.arrayBuffer().then(
        (buffer) => readDeckPackage(buffer).then((pack) => openPrepared(pack.yaml, pack.files)),
        (caught: unknown) => {
          setError(messageOf(caught));
          setCanReturn(deckRef.current !== null);
        },
      );
      return;
    }
    void file.text().then(
      (text) => openPrepared(text, new Map()),
      (caught: unknown) => {
        setError(messageOf(caught));
        setCanReturn(deckRef.current !== null);
      },
    );
  }

  function discardStored() {
    clearPersisted();
    setDeck(null);
    setSourceDeck(null);
    setDeckYaml("");
    setSession(null);
    setPackageFiles(new Map());
    setAssetUrls(new Map());
    setError(null);
    setStorageBroken(false);
    setCanReturn(false);
  }

  const fileInput = (
    <input
      ref={inputRef}
      className="file-input"
      type="file"
      accept=".yaml,.yml,.zip,text/yaml,application/yaml,application/zip"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) openFile(file);
      }}
    />
  );

  if (audienceId) return <Audience deckId={audienceId} />;
  if (!hydrated) return fileInput;
  if (error) {
    return (
      <>
        {fileInput}
        <ErrorScreen
          message={error}
          canReturn={canReturn}
          storageBroken={storageBroken}
          onOpen={() => inputRef.current?.click()}
          onReturn={() => setError(null)}
          onDiscard={discardStored}
        />
      </>
    );
  }
  if (!deck || !session) {
    if (embed) {
      return (
        <main className="start">
          <p>Waiting for the host page to send a presentation.</p>
        </main>
      );
    }
    return (
      <>
        {fileInput}
        <StartScreen
          onOpenFile={openFile}
          requestOpen={() => inputRef.current?.click()}
          onExample={() => void openPrepared(sampleDeck, new Map())}
        />
      </>
    );
  }
  return (
    <>
      {embed ? null : fileInput}
      <Shell
        key={deck.id}
        deck={deck}
        exportDeck={sourceDeck ?? deck}
        session={session}
        assets={assetUrls}
        packageFiles={packageFiles}
        sourceYaml={deckYaml}
        embed={embed}
        onSession={(recipe) => setSession((current) => (current ? recipe(current) : current))}
        onOpenFile={openFile}
        requestOpen={() => inputRef.current?.click()}
        persistError={persistError}
      />
    </>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
