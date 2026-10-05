import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { localFileUrl } from "../model/install";
import { bootDeckSource, fetchDeck, resetToShipped, shippedDeckSource, type FetchedDeck } from "./fetchDeck";

const origin = "http://127.0.0.1:4100";
const page = `${origin}/`;
const image = new Uint8Array([137, 80, 78, 71]);

async function zipOf(yaml: string, files: Record<string, Uint8Array>): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("deck.yaml", yaml);
  for (const [name, bytes] of Object.entries(files)) zip.file(name, bytes);
  return zip.generateAsync({ type: "arraybuffer" });
}

function serve(map: Record<string, { status?: number; body: BodyInit; type: string }>) {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const route = map[url];
    if (!route) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
    return new Response(route.body, { status: route.status ?? 200, headers: { "content-type": route.type } });
  };
  return { fetchImpl, calls };
}

describe("boot talk", () => {
  it("lets ?deck= outrank the config's talk, opens the config's talk without it, and leaves the rest to the stored session", () => {
    expect(bootDeckSource({ embed: false, deckParam: "other/talk.yaml", deckPath: "talk/deck.zip", origin, pageUrl: page })).toEqual({
      url: `${origin}/other/talk.yaml`,
      label: "other/talk.yaml",
      zip: false,
      baseUrl: `${origin}/other/`,
    });
    expect(bootDeckSource({ embed: false, deckParam: null, deckPath: "talk/deck.zip", origin, pageUrl: page })).toEqual({
      url: `${origin}/talk/deck.zip`,
      label: "talk/deck.zip",
      zip: true,
      baseUrl: `${origin}/talk/`,
    });
    expect(bootDeckSource({ embed: false, deckParam: " ", deckPath: undefined, origin, pageUrl: page })).toBeNull();
    expect(bootDeckSource({ embed: true, deckParam: "x.zip", deckPath: "talk/deck.zip", origin, pageUrl: page })).toBeNull();
  });

  it("reads a talk beside a disk config through the dev server, with no folder for siblings", () => {
    expect(shippedDeckSource(origin, "/home/author/theme/talk.zip")).toEqual({
      url: localFileUrl(origin, "/home/author/theme/talk.zip"),
      label: "/home/author/theme/talk.zip",
      zip: true,
    });
  });

  it("unpacks a zip talk with its files and reads a YAML talk as text", async () => {
    const { fetchImpl } = serve({
      [`${origin}/talk/deck.zip`]: { body: await zipOf("id: shipped\n", { "diagrams/a.png": image }), type: "application/zip" },
      [`${origin}/talk/other.yaml`]: { body: "id: other\n", type: "text/yaml; charset=utf-8" },
    });
    const zipped = await fetchDeck(fetchImpl, shippedDeckSource(origin, "talk/deck.zip"));
    expect(zipped.yaml).toBe("id: shipped\n");
    expect(zipped.files.get("diagrams/a.png")).toEqual(image);
    expect(zipped.baseUrl).toBe(`${origin}/talk/`);
    const plain = await fetchDeck(fetchImpl, shippedDeckSource(origin, "talk/other.yaml"));
    expect(plain.yaml).toBe("id: other\n");
    expect(plain.files.size).toBe(0);
  });

  it("fails on a missing talk and on the app shell served in its place", async () => {
    const { fetchImpl } = serve({
      [`${origin}/talk/shell.zip`]: { body: "<!doctype html><html></html>", type: "text/html" },
    });
    await expect(fetchDeck(fetchImpl, shippedDeckSource(origin, "talk/deck.zip"))).rejects.toThrow(
      /Deck failed to load \(404\): talk\/deck\.zip\nNot found/,
    );
    await expect(fetchDeck(fetchImpl, shippedDeckSource(origin, "talk/shell.zip"))).rejects.toThrow(/returned HTML/);
  });
});

describe("reset to shipped", () => {
  it("re-reads the config's talk, clears stored notes once it is ready, then shows it", async () => {
    const { fetchImpl, calls } = serve({
      [`${origin}/talk/deck.zip`]: { body: await zipOf("id: shipped\n", { "diagrams/a.png": image }), type: "application/zip" },
    });
    const order: string[] = [];
    const shown: FetchedDeck[] = [];
    await resetToShipped({
      deckPath: "talk/deck.zip",
      origin,
      fetch: fetchImpl,
      prepare: async (pack) => {
        order.push("prepare");
        return pack;
      },
      clear: () => order.push("clear"),
      apply: (pack) => {
        order.push("apply");
        shown.push(pack);
      },
    });
    expect(calls).toEqual([`${origin}/talk/deck.zip`]);
    expect(order).toEqual(["prepare", "clear", "apply"]);
    expect(shown[0]?.yaml).toBe("id: shipped\n");
    expect(shown[0]?.files.get("diagrams/a.png")).toEqual(image);
  });

  it("keeps stored notes when the shipped talk cannot be read or does not parse", async () => {
    const cleared: string[] = [];
    const missing = serve({});
    await expect(
      resetToShipped({
        deckPath: "talk/deck.zip",
        origin,
        fetch: missing.fetchImpl,
        prepare: async (pack) => pack,
        clear: () => cleared.push("missing"),
        apply: () => undefined,
      }),
    ).rejects.toThrow(/404/);
    const broken = serve({ [`${origin}/talk/deck.yaml`]: { body: "slides: [", type: "text/yaml" } });
    await expect(
      resetToShipped({
        deckPath: "talk/deck.yaml",
        origin,
        fetch: broken.fetchImpl,
        prepare: async () => {
          throw new Error("Invalid deck YAML");
        },
        clear: () => cleared.push("broken"),
        apply: () => undefined,
      }),
    ).rejects.toThrow(/Invalid deck YAML/);
    expect(cleared).toEqual([]);
  });

  it("refuses when the install names no shipped talk", async () => {
    await expect(
      resetToShipped({
        deckPath: undefined,
        origin,
        fetch: serve({}).fetchImpl,
        prepare: async (pack) => pack,
        clear: () => undefined,
        apply: () => undefined,
      }),
    ).rejects.toThrow(/names no shipped talk/);
  });
});
