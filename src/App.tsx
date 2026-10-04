import { useEffect, useRef, useState } from "react";
import { Audience } from "./layout/Audience";
import { ConfigScreen } from "./layout/ConfigScreen";
import { ErrorScreen } from "./layout/ErrorScreen";
import { Shell } from "./layout/Shell";
import { StartScreen } from "./layout/StartScreen";
import { blankDeckSource } from "./model/blank";
import { replaceListItem, replaceSlideTitle } from "./model/edit";
import { injectedConfigPath, isDiskConfigPath, loadInstall, localConfigUrl, presentTalk, resolveBootConfig, type Install } from "./model/install";
import { parseDeck } from "./model/parse";
import type { Deck } from "./model/schema";
import { serializeDeck } from "./model/serialize";
import { clampRevealed, normalizeSession, sessionFromDeck, type DeckSession } from "./model/session";
import { importPptx } from "./import/pptx";
import { bindPackageAssets, deckWithAssetUrls, packageAssetRefs, readDeckPackage } from "./package/deckPackage";
import { clearPersisted, loadPersisted, savePersisted } from "./session/store";
import { applyFontFaces } from "./theme/fonts";

const search = new URLSearchParams(window.location.search);
const embed = search.get("embed") === "1";
const audienceId = search.get("audience") === "1" ? search.get("id") : null;
const deckParam = search.get("deck");
const bootRequest = resolveBootConfig({
  cli: injectedConfigPath(
    import.meta.env.VITE_SLIDER_CONFIG,
    typeof document === "undefined" ? null : document.documentElement.getAttribute("data-slider-config"),
  ),
  query: search.get("config"),
});

type BootPhase = { kind: "loading" } | { kind: "ask"; error: string | null } | { kind: "ready" };

function browserEnv() {
  return {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, init),
    origin: window.location.origin,
  };
}

async function loadNamedConfig(path: string): Promise<Install> {
  if (isDiskConfigPath(path)) {
    const response = await fetch(localConfigUrl(window.location.origin, path));
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Config not found: ${path}`);
    }
    return loadInstall(browserEnv(), { source: text, configPath: path });
  }
  return loadInstall(browserEnv(), { path });
}

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
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [install, setInstall] = useState<Install | null>(null);
  const [bootPhase, setBootPhase] = useState<BootPhase>(
    bootRequest.status === "config-required" ? { kind: "ask", error: null } : { kind: "loading" },
  );
  const yamlGen = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<Deck | null>(null);
  const installRef = useRef<Install | null>(null);
  const openRef = useRef<(source: string, files: Map<string, Uint8Array>, baseUrl?: string) => Promise<void>>(
    async () => undefined,
  );
  deckRef.current = deck;

  async function openPrepared(source: string, files: Map<string, Uint8Array>, baseUrl?: string) {
    const loaded = installRef.current;
    if (!loaded) throw new Error("The theme package is not loaded.");
    try {
      const parsed = parseDeck(source);
      const presented = presentTalk(parsed, loaded.manifest);
      const next = sessionFromDeck(presented);
      parseDeck(serializeDeck(parsed, next));
      const deckUrls = await bindPackageAssets(packageAssetRefs(parsed), files, baseUrl);
      const urls = new Map(loaded.assetUrls);
      for (const [key, value] of deckUrls) urls.set(key, value);
      setSourceDeck(parsed);
      setDeck(deckWithAssetUrls(presented, urls));
      setDeckYaml(source);
      setPackageFiles(files);
      setAssetUrls(urls);
      setSession(next);
      setError(null);
      setCanReturn(false);
      setStorageBroken(false);
      setPersistError(null);
      setYamlError(null);
    } catch (caught) {
      setError(messageOf(caught));
      setCanReturn(deckRef.current !== null);
    }
  }
  openRef.current = openPrepared;

  function onYaml(text: string) {
    const gen = ++yamlGen.current;
    void (async () => {
      try {
        const loaded = installRef.current;
        if (!loaded) throw new Error("The theme package is not loaded.");
        const parsed = parseDeck(text);
        const presented = presentTalk(parsed, loaded.manifest);
        const refs = packageAssetRefs(parsed);
        const deckUrls = refs.every((ref) => assetUrls.has(ref)) ? assetUrls : await bindPackageAssets(refs, packageFiles);
        const urls = new Map(loaded.assetUrls);
        for (const [key, value] of deckUrls) urls.set(key, value);
        if (yamlGen.current !== gen) return;
        setAssetUrls(urls);
        setSourceDeck(parsed);
        setDeck(deckWithAssetUrls(presented, urls));
        setDeckYaml(text);
        setYamlError(null);
        setSession((current) => {
          if (!current) return current;
          const slideIndex = Math.min(current.slideIndex, parsed.slides.length - 1);
          const slide = parsed.slides[slideIndex];
          if (!slide) return current;
          return { ...current, slideIndex, revealed: clampRevealed(slide, current.revealed) };
        });
      } catch (caught) {
        if (yamlGen.current !== gen) return;
        setYamlError(messageOf(caught));
      }
    })();
  }

  function commitEdit(mutate: (current: Deck) => Deck) {
    if (!sourceDeck || !session) return;
    try {
      const edited = mutate(sourceDeck);
      const yaml = serializeDeck(edited, sessionFromDeck(edited));
      parseDeck(yaml);
      onYaml(yaml);
    } catch (caught) {
      setYamlError(messageOf(caught));
    }
  }

  useEffect(() => {
    if (!install?.manifest.fonts) return;
    return applyFontFaces(install.manifest.fonts, install.assetUrls);
  }, [install]);

  useEffect(() => {
    if (bootRequest.status !== "path") return;
    let cancel = false;
    void loadNamedConfig(bootRequest.path)
      .then((loaded) => {
        if (cancel) return;
        installRef.current = loaded;
        setInstall(loaded);
        setBootPhase({ kind: "ready" });
      })
      .catch((caught: unknown) => {
        if (cancel) return;
        setBootPhase({ kind: "ask", error: messageOf(caught) });
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function loadConfigPath(path: string) {
    setBootPhase({ kind: "loading" });
    try {
      const loaded = await loadNamedConfig(path);
      installRef.current = loaded;
      setInstall(loaded);
      setBootPhase({ kind: "ready" });
    } catch (caught) {
      setBootPhase({ kind: "ask", error: messageOf(caught) });
    }
  }

  async function loadConfigSource(source: string) {
    setBootPhase({ kind: "loading" });
    try {
      const loaded = await loadInstall(browserEnv(), { source });
      installRef.current = loaded;
      setInstall(loaded);
      setBootPhase({ kind: "ready" });
    } catch (caught) {
      setBootPhase({ kind: "ask", error: messageOf(caught) });
    }
  }

  useEffect(() => {
    if (!install) return;
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
        const presented = presentTalk(parsed, install.manifest);
        const next = normalizeSession(presented, saved.session);
        parseDeck(serializeDeck(parsed, next));
        const urls = new Map(install.assetUrls);
        setSourceDeck(parsed);
        setDeck(deckWithAssetUrls(presented, urls));
        setDeckYaml(saved.deckYaml);
        setAssetUrls(urls);
        setSession(next);
      }
    } catch (caught) {
      setError(messageOf(caught));
      setStorageBroken(true);
      setCanReturn(false);
    } finally {
      setHydrated(true);
    }
  }, [install]);

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
    if (name.endsWith(".pptx")) {
      void file
        .arrayBuffer()
        .then((buffer) => importPptx(buffer, file.name))
        .then((yaml) => openPrepared(yaml, new Map()))
        .catch((caught: unknown) => {
          setError(messageOf(caught));
          setCanReturn(deckRef.current !== null);
        });
      return;
    }
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
      accept=".yaml,.yml,.zip,.pptx,text/yaml,application/yaml,application/zip,application/vnd.openxmlformats-officedocument.presentationml.presentation"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) openFile(file);
      }}
    />
  );

  if (!install) {
    if (bootPhase.kind === "ask") {
      return (
        <ConfigScreen
          error={bootPhase.error}
          onPath={(path) => void loadConfigPath(path)}
          onSource={(source) => void loadConfigSource(source)}
          onFailure={(message) => setBootPhase({ kind: "ask", error: message })}
        />
      );
    }
    if (bootPhase.kind === "loading") {
      return (
        <main className="start" data-boot="loading">
          <p>Loading the theme.</p>
        </main>
      );
    }
    throw new Error("The theme package is not loaded.");
  }
  if (audienceId) return <Audience deckId={audienceId} install={install} />;
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
          install={install}
          onOpenFile={openFile}
          requestOpen={() => inputRef.current?.click()}
          onBlank={() => {
            void openPrepared(blankDeckSource(), new Map());
          }}
          onExample={(path) => {
            void (async () => {
              try {
                const response = await fetch(new URL(path, window.location.origin));
                if (!response.ok) {
                  throw new Error(`Example failed to load (${response.status}): ${path}`);
                }
                const text = await response.text();
                const start = text.trimStart().slice(0, 20).toLowerCase();
                if (start.startsWith("<!doctype") || start.startsWith("<html")) {
                  throw new Error(`Example not found: ${path}. The server returned HTML instead of the deck.`);
                }
                await openPrepared(text, new Map());
              } catch (caught) {
                setError(messageOf(caught));
                setCanReturn(deckRef.current !== null);
              }
            })();
          }}
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
        manifestPath={install.manifestPath}
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
        yamlError={yamlError}
        onYaml={onYaml}
        onEditTitle={(title) =>
          commitEdit((current) => replaceSlideTitle(current, current.slides[session.slideIndex]?.id ?? "", title))
        }
        onEditItem={(blockIndex, itemIndex, text) =>
          commitEdit((current) => replaceListItem(current, current.slides[session.slideIndex]?.id ?? "", blockIndex, itemIndex, text))
        }
      />
    </>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
