import { useEffect, useRef, useState } from "react";
import sampleDeck from "./sample/deck.yaml?raw";
import { ErrorScreen } from "./layout/ErrorScreen";
import { Shell } from "./layout/Shell";
import { StartScreen } from "./layout/StartScreen";
import { parseDeck } from "./model/parse";
import type { Deck } from "./model/schema";
import { serializeDeck } from "./model/serialize";
import { normalizeSession, sessionFromDeck, type DeckSession } from "./model/session";
import { clearPersisted, loadPersisted, savePersisted } from "./session/store";

export function App() {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckYaml, setDeckYaml] = useState("");
  const [session, setSession] = useState<DeckSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canReturn, setCanReturn] = useState(false);
  const [storageBroken, setStorageBroken] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);
  deckRef.current = deck;

  useEffect(() => {
    try {
      const saved = loadPersisted();
      if (saved) {
        const parsed = parseDeck(saved.deckYaml);
        const next = normalizeSession(parsed, saved.session);
        parseDeck(serializeDeck(parsed, next));
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
    if (!hydrated || !deck || !session) return;
    try {
      savePersisted({ deckYaml, session });
      setPersistError(null);
    } catch (caught) {
      setPersistError(`Notes could not be stored in this browser. Download the YAML before you leave. ${messageOf(caught)}`);
    }
  }, [hydrated, deck, deckYaml, session]);

  useEffect(() => {
    if (!persistError) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [persistError]);

  function openSource(source: string) {
    try {
      const parsed = parseDeck(source);
      const next = sessionFromDeck(parsed);
      parseDeck(serializeDeck(parsed, next));
      setDeck(parsed);
      setDeckYaml(source);
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

  function openFile(file: File) {
    void file.text().then(openSource, (caught: unknown) => {
      setError(messageOf(caught));
      setCanReturn(deckRef.current !== null);
    });
  }

  function discardStored() {
    clearPersisted();
    setDeck(null);
    setDeckYaml("");
    setSession(null);
    setError(null);
    setStorageBroken(false);
    setCanReturn(false);
  }

  const fileInput = (
    <input
      ref={inputRef}
      className="file-input"
      type="file"
      accept=".yaml,.yml,text/yaml,application/yaml"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) openFile(file);
      }}
    />
  );

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
    return (
      <>
        {fileInput}
        <StartScreen
          onOpenFile={openFile}
          requestOpen={() => inputRef.current?.click()}
          onExample={() => openSource(sampleDeck)}
        />
      </>
    );
  }
  return (
    <>
      {fileInput}
      <Shell
        key={deck.id}
        deck={deck}
        session={session}
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
